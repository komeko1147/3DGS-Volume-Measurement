import './styles.css';
import { createWorldSplatDemo } from './scenes/worldSplatDemo.js';

createWorldSplatDemo(document.querySelector('#app')).catch((error) => {
  console.error(error);

  const root = document.querySelector('#app');
  root.innerHTML = '';

  const message = document.createElement('div');
  message.className = 'app-error';
  message.innerHTML = `
    <h1>Unable to start PlayCanvas</h1>
    <p>Check the browser console for the full error details.</p>
  `;

  root.appendChild(message);
});
