// This view is a minimal loading screen shown briefly while the daemon boots.
// Once the daemon is ready the BrowserWindow navigates to the daemon's URL,
// so this view is rarely visible for more than a moment.

const loading = document.getElementById("loading");
if (loading) {
  const p = loading.querySelector("p");
  let dots = 0;
  setInterval(() => {
    dots = (dots + 1) % 4;
    if (p) {
      p.textContent = "Starting daemon" + ".".repeat(dots);
    }
  }, 400);
}
