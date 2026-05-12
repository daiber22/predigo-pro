'use client';

import { useEffect, useMemo, useState } from 'react';

type InstallOutcome = 'accepted' | 'dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: InstallOutcome; platform: string }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

function detectStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function PwaControls() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<'idle' | 'ready' | 'installed'>('idle');
  const [serviceWorkerMessage, setServiceWorkerMessage] = useState('');
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const standalone = detectStandalone();
    if (standalone) {
      setInstallState('installed');
    }

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    setShowIosHint(isIos && !standalone);

    if ('serviceWorker' in window.navigator) {
      window.navigator.serviceWorker
        .register('/sw.js')
        .then(() => setServiceWorkerMessage('Modo app activo'))
        .catch(() => setServiceWorkerMessage('No se pudo activar el modo app'));
    } else {
      setServiceWorkerMessage('Este navegador no soporta modo app completo');
    }

    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setInstallState((current) => (current === 'installed' ? current : 'ready'));
    };

    const handleInstalled = () => {
      setInstallState('installed');
      setDeferredPrompt(null);
      setShowIosHint(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const installLabel = useMemo(() => {
    if (installState === 'installed') return 'App instalada';
    if (installState === 'ready') return 'Instalar app';
    return 'Modo app';
  }, [installState]);

  async function handleInstallClick() {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      setInstallState('installed');
      setShowIosHint(false);
    }

    setDeferredPrompt(null);
  }

  if (!serviceWorkerMessage && installState === 'idle' && !showIosHint) {
    return null;
  }

  return (
    <div className="pwa-dock" aria-live="polite">
      <div className="pwa-dock__copy">
        <strong>{installLabel}</strong>
        <span>{serviceWorkerMessage || 'Abre la app como acceso directo en tu teléfono.'}</span>
        {showIosHint ? <small>En iPhone: comparte la página y toca “Agregar a pantalla de inicio”.</small> : null}
      </div>
      {installState === 'ready' && deferredPrompt ? (
        <button type="button" className="primary" onClick={handleInstallClick}>
          Instalar ahora
        </button>
      ) : null}
    </div>
  );
}
