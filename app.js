function saveNote() {
  const value = document.getElementById('note').value;
  localStorage.setItem('note', value);
  loadNote();
}

function loadNote() {
  document.getElementById('output').innerText =
    localStorage.getItem('note') || 'Nothing saved yet';
}

window.onload = () => {
  loadNote();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
};
