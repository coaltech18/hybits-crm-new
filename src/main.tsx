import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);

function StartupError({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-paper p-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{message}</p>
      </div>
    </div>
  );
}

// The Supabase client throws at import time when these are missing, before
// React (and the ErrorBoundary) can render anything. Check first, then load
// the app.
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  root.render(
    <StartupError
      title="Configuration error"
      message="VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set. Add them to the .env file (or the hosting environment) and rebuild."
    />
  );
} else {
  import('./App')
    .then(({ default: App }) => {
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    })
    .catch((error: unknown) => {
      console.error('[main] Failed to load the app:', error);
      root.render(
        <StartupError
          title="Couldn't start Hybits"
          message="The app failed to load. Check your connection and reload the page."
        />
      );
    });
}
