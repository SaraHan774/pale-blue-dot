#!/bin/bash
set -euo pipefail

# Build and install reader-mobile APK to a remote ADB device
# Usage: ./build-and-install.sh [port]
#        ./build-and-install.sh [ip] [port]
# Example: ./build-and-install.sh              # 192.168.45.103:5555
#          ./build-and-install.sh 44911         # 192.168.45.103:44911
#          ./build-and-install.sh 10.0.0.5 5555 # 10.0.0.5:5555

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"

DEFAULT_IP="192.168.45.103"
DEFAULT_PORT="5555"

if [[ $# -eq 0 ]]; then
  DEVICE_IP="$DEFAULT_IP"
  DEVICE_PORT="$DEFAULT_PORT"
elif [[ $# -eq 1 ]]; then
  # Single arg: if it's all digits, treat as port; otherwise treat as IP
  if [[ "$1" =~ ^[0-9]+$ && ! "$1" =~ \. ]]; then
    DEVICE_IP="$DEFAULT_IP"
    DEVICE_PORT="$1"
  else
    DEVICE_IP="$1"
    DEVICE_PORT="$DEFAULT_PORT"
  fi
else
  DEVICE_IP="$1"
  DEVICE_PORT="$2"
fi
DEVICE="${DEVICE_IP}:${DEVICE_PORT}"

APK_PATH="$SCRIPT_DIR/android/app/build/outputs/apk/release/app-release.apk"
APK_DEBUG_PATH="$SCRIPT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"

# --- Step 1: Connect to remote device ---
echo "=> Connecting to $DEVICE ..."
"$ADB" connect "$DEVICE"

# Verify connection
if ! "$ADB" -s "$DEVICE" get-state &>/dev/null; then
  echo "ERROR: Failed to connect to $DEVICE"
  exit 1
fi
echo "   Connected."

# --- Step 2: Build APK ---
echo "=> Building release APK ..."
cd "$SCRIPT_DIR/android"

if ./gradlew assembleRelease; then
  FINAL_APK="$APK_PATH"
  echo "   Release APK built successfully."
else
  echo "   Release build failed, falling back to debug build ..."
  ./gradlew assembleDebug
  FINAL_APK="$APK_DEBUG_PATH"
  echo "   Debug APK built successfully."
fi

cd "$SCRIPT_DIR"

if [[ ! -f "$FINAL_APK" ]]; then
  echo "ERROR: APK not found at $FINAL_APK"
  exit 1
fi

echo "   APK: $FINAL_APK ($(du -h "$FINAL_APK" | cut -f1))"

# --- Step 3: Install APK ---
echo "=> Installing APK to $DEVICE ..."
"$ADB" -s "$DEVICE" install -r "$FINAL_APK"
echo "   Installed."

# --- Step 4: Launch app ---
PACKAGE="com.palebluedot.reader"
MAIN_ACTIVITY="${PACKAGE}.MainActivity"

echo "=> Launching $PACKAGE ..."
"$ADB" -s "$DEVICE" shell am start -n "${PACKAGE}/${MAIN_ACTIVITY}"

echo ""
echo "Done! App is running on $DEVICE"
