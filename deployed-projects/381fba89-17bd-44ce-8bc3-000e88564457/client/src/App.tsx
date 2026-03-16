import React from 'react';
import { HelloCard } from './components/HelloCard.js';

export const App = (): React.JSX.Element => {
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', padding: 24 }}>
      <h1>Hello World</h1>
      <HelloCard />
    </div>
  );
};
