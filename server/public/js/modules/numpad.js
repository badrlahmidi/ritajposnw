export const NUMPAD = {
    activeInput: null,
    value: '',
    callback: null,

    init() {
        if (document.getElementById('numpadOverlay')) return; // Already initialized

        const el = document.createElement('div');
        el.innerHTML = `
    <div id="numpadOverlay" class="numpad-overlay" onclick="if(event.target.id === 'numpadOverlay') NUMPAD.close()">
      <div class="numpad-container">
        <div id="numpadDisplay" class="numpad-display">0</div>
        <div class="numpad-grid">
          <button class="numpad-btn" onclick="NUMPAD.tap('7')">7</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('8')">8</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('9')">9</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('4')">4</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('5')">5</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('6')">6</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('1')">1</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('2')">2</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('3')">3</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('.')">.</button>
          <button class="numpad-btn" onclick="NUMPAD.tap('0')">0</button>
          <button class="numpad-btn danger" onclick="NUMPAD.clear()">⌫</button>
          <button class="numpad-btn primary" style="grid-column:1/-1;margin-top:10px" onclick="NUMPAD.confirm()">OK ↵</button>
        </div>
      </div>
    </div>`;
        document.body.appendChild(el);

        // Attach listeners
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.classList.contains('use-numpad'))) {
                // Check if touch device or forced
                if (window.matchMedia('(pointer: coarse)').matches || e.target.classList.contains('force-numpad')) {
                    e.preventDefault();
                    e.target.blur(); // Prevent native keyboard
                    this.open(e.target);
                }
            }
        });

        // Expose to window for inline onclick handlers in HTML string
        window.NUMPAD = this;
    },

    open(inputElement, onConfirm = null) {
        this.activeInput = inputElement;
        this.value = '';
        this.callback = onConfirm;
        const display = document.getElementById('numpadDisplay');
        const overlay = document.getElementById('numpadOverlay');
        if (display && overlay) {
            display.textContent = inputElement.value || '0';
            overlay.style.display = 'flex';
        }
    },

    tap(char) {
        if (char === '.' && this.value.includes('.')) return;
        this.value += char;
        const display = document.getElementById('numpadDisplay');
        if (display) display.textContent = this.value;
    },

    clear() {
        this.value = this.value.slice(0, -1);
        const display = document.getElementById('numpadDisplay');
        if (display) display.textContent = this.value || '0';
    },

    confirm() {
        if (this.activeInput) {
            this.activeInput.value = this.value;
            this.activeInput.dispatchEvent(new Event('input', { bubbles: true }));
            this.activeInput.dispatchEvent(new Event('change', { bubbles: true }));
            if (this.callback) this.callback(this.value);
        }
        this.close();
    },

    close() {
        const overlay = document.getElementById('numpadOverlay');
        if (overlay) overlay.style.display = 'none';
        this.activeInput = null;
    }
};
