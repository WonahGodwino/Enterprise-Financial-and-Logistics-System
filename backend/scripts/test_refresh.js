// Simple test script to POST refresh-token multiple times using global fetch
(async () => {
  try {
    for (let i = 0; i < 6; i++) {
      const res = await fetch('http://localhost:5000/api/v1/auth/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'stub-refresh' }),
      });
      const text = await res.text();
      console.log(i, 'STATUS', res.status, text);
      await new Promise((r) => setTimeout(r, 200));
    }
  } catch (e) {
    console.error('ERROR', e);
    process.exit(1);
  }
})();
