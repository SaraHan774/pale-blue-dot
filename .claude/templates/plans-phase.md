# Phase 템플릿

`/pbd-plan create` 가 새 phase 를 추가할 때 사용하는 블록.

---

## Active Phase

### Phase {N}: {phase 이름}

**시작**: YYYY-MM-DD
**DoD**: {phase 전체가 끝났다고 인정할 측정 가능한 기준 1-2문장}

| Task | 내용 | DoD | Depends | Status | Owner |
|------|------|-----|---------|--------|-------|
| T1 | {task 한 줄 요약} | {측정 가능한 완료 기준} | - | pm:요청 | self |

---

## task 추가 시 형식

`/pbd-plan add "T<n>: <한 줄 요약> (DoD: <측정 기준>)"` 가 표에 다음 행을 추가:

```
| T<n> | <한 줄 요약> | <측정 기준> | <Depends> | pm:요청 | self |
```

## 상태 전이

```
pm:요청 → cc:진행 → cc:완료 → pm:확인
```

권한:
- `pm:*` → 사용자 / `pbd-plan` skill
- `cc:*` → `pbd-work` skill (worker-report 검증 후)

자세한 내용은 [.claude/rules/plans-management.md](../rules/plans-management.md) 참조.
