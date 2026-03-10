import { useState } from 'react';
import { Button, ButtonGroup } from '@/components/Button';
import './ButtonShowcase.css';

/**
 * Button Showcase Page
 *
 * Demonstrates all button variants and states in the Pale Blue Dot design system.
 * This page serves as both documentation and visual testing ground.
 */
export function ButtonShowcase() {
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const simulateLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="button-showcase">
      <div className="showcase-header">
        <h1>Pale Blue Dot Button System</h1>
        <p className="showcase-subtitle">
          A contemplative button design inspired by Carl Sagan's perspective on humanity's place in the cosmos.
          Soft, elegant, and humble - not aggressive or overstated.
        </p>
      </div>

      {/* Variants */}
      <section className="showcase-section">
        <h2>Button Variants</h2>
        <p className="section-description">
          Each variant serves a specific purpose in the interface hierarchy.
        </p>

        <div className="showcase-grid">
          <div className="showcase-item">
            <h3>Primary</h3>
            <p>The Pale Blue Dot itself - main actions</p>
            <Button variant="primary">Create Page</Button>
            <code className="code-example">
              &lt;Button variant="primary"&gt;Create Page&lt;/Button&gt;
            </code>
          </div>

          <div className="showcase-item">
            <h3>Secondary</h3>
            <p>Atmospheric, ghostly - supporting actions</p>
            <Button variant="secondary">Cancel</Button>
            <code className="code-example">
              &lt;Button variant="secondary"&gt;Cancel&lt;/Button&gt;
            </code>
          </div>

          <div className="showcase-item">
            <h3>Ghost</h3>
            <p>Minimal, ethereal - tertiary actions</p>
            <Button variant="ghost">View Details</Button>
            <code className="code-example">
              &lt;Button variant="ghost"&gt;View Details&lt;/Button&gt;
            </code>
          </div>

          <div className="showcase-item">
            <h3>Danger</h3>
            <p>Solar flare - destructive but elegant</p>
            <Button variant="danger">Delete Page</Button>
            <code className="code-example">
              &lt;Button variant="danger"&gt;Delete Page&lt;/Button&gt;
            </code>
          </div>

          <div className="showcase-item">
            <h3>Icon</h3>
            <p>Constellation point - compact actions</p>
            <Button
              variant="icon"
              icon={<span className="material-symbols-outlined">add</span>}
            />
            <code className="code-example">
              &lt;Button variant="icon" icon=&#123;&lt;Icon /&gt;&#125; /&gt;
            </code>
          </div>
        </div>
      </section>

      {/* Sizes */}
      <section className="showcase-section">
        <h2>Button Sizes</h2>
        <div className="showcase-row">
          <div className="showcase-item">
            <h3>Small</h3>
            <Button variant="primary" size="sm">
              Small Button
            </Button>
          </div>

          <div className="showcase-item">
            <h3>Medium (Default)</h3>
            <Button variant="primary">Medium Button</Button>
          </div>

          <div className="showcase-item">
            <h3>Large</h3>
            <Button variant="primary" size="lg">
              Large Button
            </Button>
          </div>
        </div>
      </section>

      {/* States */}
      <section className="showcase-section">
        <h2>Button States</h2>
        <div className="showcase-grid">
          <div className="showcase-item">
            <h3>Default</h3>
            <Button variant="primary">Normal State</Button>
          </div>

          <div className="showcase-item">
            <h3>Hover</h3>
            <p className="state-note">Hover over any button to see the effect</p>
            <Button variant="primary">Hover Me</Button>
          </div>

          <div className="showcase-item">
            <h3>Loading</h3>
            <Button variant="primary" loading={loading} onClick={simulateLoading}>
              {loading ? 'Loading...' : 'Click to Load'}
            </Button>
          </div>

          <div className="showcase-item">
            <h3>Disabled</h3>
            <div className="state-controls">
              <label>
                <input
                  type="checkbox"
                  checked={disabled}
                  onChange={e => setDisabled(e.target.checked)}
                />
                Toggle disabled
              </label>
            </div>
            <Button variant="primary" disabled={disabled}>
              Disabled Button
            </Button>
          </div>
        </div>
      </section>

      {/* With Icons */}
      <section className="showcase-section">
        <h2>Buttons with Icons</h2>
        <div className="showcase-grid">
          <div className="showcase-item">
            <h3>Icon Left</h3>
            <Button
              variant="primary"
              icon={<span className="material-symbols-outlined">add</span>}
              iconPosition="left"
            >
              New Page
            </Button>
          </div>

          <div className="showcase-item">
            <h3>Icon Right</h3>
            <Button
              variant="secondary"
              icon={<span className="material-symbols-outlined">arrow_forward</span>}
              iconPosition="right"
            >
              Continue
            </Button>
          </div>

          <div className="showcase-item">
            <h3>Icon Only - Small</h3>
            <Button
              variant="icon"
              size="sm"
              icon={<span className="material-symbols-outlined">settings</span>}
            />
          </div>

          <div className="showcase-item">
            <h3>Icon Only - Large</h3>
            <Button
              variant="icon"
              size="lg"
              icon={<span className="material-symbols-outlined">favorite</span>}
            />
          </div>
        </div>
      </section>

      {/* Button Groups */}
      <section className="showcase-section">
        <h2>Button Groups</h2>
        <div className="showcase-column">
          <div className="showcase-item">
            <h3>Normal Spacing</h3>
            <ButtonGroup>
              <Button variant="secondary">Cancel</Button>
              <Button variant="primary">Save</Button>
            </ButtonGroup>
          </div>

          <div className="showcase-item">
            <h3>Compact Spacing</h3>
            <ButtonGroup spacing="compact">
              <Button variant="ghost" icon={<span className="material-symbols-outlined">format_bold</span>} />
              <Button variant="ghost" icon={<span className="material-symbols-outlined">format_italic</span>} />
              <Button variant="ghost" icon={<span className="material-symbols-outlined">format_underlined</span>} />
            </ButtonGroup>
          </div>

          <div className="showcase-item">
            <h3>Attached (Segmented Control)</h3>
            <ButtonGroup spacing="attached">
              <Button variant="secondary">Day</Button>
              <Button variant="secondary">Week</Button>
              <Button variant="secondary">Month</Button>
            </ButtonGroup>
          </div>
        </div>
      </section>

      {/* Full Width */}
      <section className="showcase-section">
        <h2>Full Width Button</h2>
        <div className="showcase-item" style={{ maxWidth: '400px' }}>
          <Button variant="primary" block>
            Full Width Button
          </Button>
        </div>
      </section>

      {/* Real World Examples */}
      <section className="showcase-section">
        <h2>Real World Examples</h2>
        <div className="showcase-examples">
          <div className="example-card">
            <h3>Modal Actions</h3>
            <div className="example-content">
              <ButtonGroup>
                <Button variant="secondary">Cancel</Button>
                <Button variant="primary">Create Page</Button>
              </ButtonGroup>
            </div>
          </div>

          <div className="example-card">
            <h3>Toolbar</h3>
            <div className="example-content">
              <ButtonGroup spacing="compact">
                <Button variant="icon" icon={<span className="material-symbols-outlined">arrow_back</span>} />
                <Button variant="icon" icon={<span className="material-symbols-outlined">toc</span>} />
                <Button variant="icon" icon={<span className="material-symbols-outlined">width_wide</span>} />
                <Button variant="icon" icon={<span className="material-symbols-outlined">more_vert</span>} />
              </ButtonGroup>
            </div>
          </div>

          <div className="example-card">
            <h3>Destructive Action</h3>
            <div className="example-content">
              <ButtonGroup>
                <Button variant="secondary">Keep Page</Button>
                <Button variant="danger">Delete Forever</Button>
              </ButtonGroup>
            </div>
          </div>

          <div className="example-card">
            <h3>Form Actions</h3>
            <div className="example-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Button variant="primary" block>
                Save Changes
              </Button>
              <Button variant="ghost" block>
                Discard Changes
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Legacy Classes */}
      <section className="showcase-section">
        <h2>Legacy Classes (Backward Compatible)</h2>
        <p className="section-description">
          Existing button classes have been updated with the new design.
        </p>
        <div className="showcase-grid">
          <div className="showcase-item">
            <h3>.btn .btn-primary</h3>
            <button className="btn btn-primary">Legacy Primary</button>
          </div>

          <div className="showcase-item">
            <h3>.btn .btn-secondary</h3>
            <button className="btn btn-secondary">Legacy Secondary</button>
          </div>

          <div className="showcase-item">
            <h3>.btn .btn-danger</h3>
            <button className="btn btn-danger">Legacy Danger</button>
          </div>

          <div className="showcase-item">
            <h3>.btn-icon</h3>
            <button className="btn-icon">
              <span className="material-symbols-outlined">star</span>
            </button>
          </div>
        </div>
      </section>

      {/* Design Principles */}
      <section className="showcase-section showcase-principles">
        <h2>Design Principles</h2>
        <div className="principles-grid">
          <div className="principle-card">
            <h3>🌌 Cosmic Depth</h3>
            <p>
              Subtle shadows and gradients create dimensionality without being
              flashy. Buttons feel like objects floating in space.
            </p>
          </div>

          <div className="principle-card">
            <h3>🕊️ Contemplative</h3>
            <p>
              Soft colors, gentle transitions, and reduced contrast encourage
              thoughtful interaction rather than impulsive clicks.
            </p>
          </div>

          <div className="principle-card">
            <h3>✨ Humble Elegance</h3>
            <p>
              Beautiful without being ostentatious. The design serves the user's
              goals, not the designer's ego.
            </p>
          </div>

          <div className="principle-card">
            <h3>🌊 Smooth Motion</h3>
            <p>
              Transitions use cubic-bezier easing that mimics natural,
              celestial motion - nothing jarring or abrupt.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
