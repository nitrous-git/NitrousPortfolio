/* Page enhancements are independent of the WebGL viewer. */
const copyButton = document.getElementById('copy-python');
copyButton.addEventListener('click', async () => {
  const text = document.getElementById('python-source').textContent;
  const status = document.getElementById('copy-status');
  try {
    if (!navigator.clipboard) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    status.textContent = 'Code copied.';
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    document.querySelector('.source-details').open = true;
    range.selectNodeContents(document.getElementById('python-source'));
    selection.removeAllRanges(); selection.addRange(range);
    status.textContent = 'Code selected: Ctrl+C / ⌘C.';
  }
});
fetch('../assets/devlog_graphene/results.json')
  .then(r => { if (!r.ok) throw new Error('Missing results'); return r.json(); })
  .then(result => {
    if (result.validation !== 'passed') return;
    const error = result.eigensolver_max_error_eV.toExponential(2);
    document.getElementById('validation-summary').textContent = `Checks passed · maximum difference from eigvalsh: ${error} eV over 200 points.`;
  }).catch(() => {});
import('./graphene.js').catch(() => {
  document.getElementById('scene-status').textContent = 'Explorer unavailable. The lattice figure and Python results remain accessible.';
  document.querySelectorAll('.viewer-controls input, .viewer-controls button, .view-button').forEach(el => { el.disabled = true; });
});
