import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FOUNDATION_SCOPE } from '../../shared/src/scope';
import './style.css';

function App() {
  return (
    <main>
      <h1>MyDms Field PWA</h1>
      <p>Field PWA shell — OFFLINE WRITE DISABLED</p>
      <p aria-live="polite" role="status">NOT_READY / NO TENANT OR BUSINESS API</p>
      <dl>
        <dt>Product Verified</dt><dd>{String(FOUNDATION_SCOPE.productVerified)}</dd>
        <dt>Offline write</dt><dd>{String(FOUNDATION_SCOPE.offlineWriteEnabled)}</dd>
        <dt>Production cutover</dt><dd>{String(FOUNDATION_SCOPE.productionCutoverEnabled)}</dd>
      </dl>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(<StrictMode><App /></StrictMode>);
