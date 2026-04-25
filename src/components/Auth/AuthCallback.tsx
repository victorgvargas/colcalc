import { useEffect } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { API_BASE_URL } from '../../api/backend';

/**
 * The magic-link email points browsers to `${APP_BASE_URL}/auth/callback?token=...`
 * (i.e. this route on the FE). The backend's `/api/auth/callback` is what
 * actually consumes the token and issues the session cookie; it then 302s
 * back to `${APP_BASE_URL}/calculator`. So all this component does is hand
 * control off to the server endpoint so the cookie lands in the browser.
 *
 * We use a full-page navigation (not fetch) because:
 * - the cookie must be accepted by the browser for subsequent requests;
 * - the server redirects with Location to the FE once done.
 */
const AuthCallback: React.FC = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) {
      window.location.replace('/calculator');
      return;
    }
    const base = API_BASE_URL.startsWith('http')
      ? API_BASE_URL
      : `${window.location.origin}${API_BASE_URL}`;
    window.location.replace(`${base}/auth/callback?token=${encodeURIComponent(token)}`);
  }, []);

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        minHeight: 320,
      }}
    >
      <CircularProgress />
      <Typography variant="body2" color="text.secondary">
        Signing you in…
      </Typography>
    </Box>
  );
};

export default AuthCallback;
