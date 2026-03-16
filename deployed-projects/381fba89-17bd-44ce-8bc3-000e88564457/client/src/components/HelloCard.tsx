import React, { useState } from 'react';
import { useHello } from '../hooks/useHello.js';

export const HelloCard = (): React.JSX.Element => {
  const [name, setName] = useState<string>('');
  const { loading, data, error } = useHello(name.trim() ? name.trim() : undefined);

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, maxWidth: 520 }}>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Name (optional)
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ada"
          style={{ display: 'block', marginTop: 6, width: '100%', padding: 10, borderRadius: 10, border: '1px solid #ccc' }}
        />
      </label>

      <div style={{ marginTop: 12 }}>
        {loading && <div>Loading…</div>}
        {error && <div style={{ color: '#b00020' }}>{error}</div>}
        {data && (
          <div style={{ fontSize: 18 }}>
            <strong>API says:</strong> {data.message}
          </div>
        )}
      </div>

      <p style={{ marginTop: 12, color: '#555' }}>
        Endpoint: <code>/api/hello</code>
      </p>
    </div>
  );
};
