// Solmar City — keyboard and mouse input, with edge-triggered presses
// (a key that was just pressed this frame) so menus and car entry feel
// responsive instead of repeating.

export class Input {
  constructor(canvas) {
    this.keys = {};
    this.pressed = {};
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      const key = e.key.toLowerCase();
      if (!this.keys[key]) this.pressed[key] = true;
      this.keys[key] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
      this.mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.mouseClicked = true;
      const rect = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
      this.mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
    window.addEventListener('blur', () => {
      this.keys = {};
    });
  }

  down(...names) {
    return names.some((n) => this.keys[n]);
  }

  // True only on the first frame the key is held.
  justPressed(...names) {
    return names.some((n) => this.pressed[n]);
  }

  endFrame() {
    this.pressed = {};
    this.mouseClicked = false;
  }
}
