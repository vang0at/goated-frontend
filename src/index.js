import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <PrivyProvider
    appId={process.env.REACT_APP_PRIVY_APP_ID || 'YOUR_PRIVY_APP_ID'}
    config={{
      loginMethods: ['twitter', 'wallet', 'google', 'email'],
      appearance: {
        theme: 'dark',
        accentColor: '#00ff88',
        showWalletLoginFirst: false,
      },
      embeddedWallets: {
        createOnLogin: 'users-without-wallets',
      },
    }}
  >
    <App />
  </PrivyProvider>
);
