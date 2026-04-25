import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { ApiError } from '../../api/backend';
import { useAuth } from '../../auth/AuthContext';

type Props = {
  open: boolean;
  onClose: () => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LoginDialog: React.FC<Props> = ({ open, onClose }) => {
  const { requestLink } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (submitting) return;
    setEmail('');
    setSent(false);
    setError(null);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      await requestLink(trimmed);
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RATE_LIMITED') {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        setError(
          err instanceof Error ? err.message : 'Could not send magic link. Please try again.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit}>
        <DialogTitle>Sign in to sync</DialogTitle>
        <DialogContent>
          {sent ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body1">Check your inbox.</Typography>
              <DialogContentText>
                If an account exists for <strong>{email.trim()}</strong>, we've emailed a sign-in
                link. The link expires in 15 minutes.
              </DialogContentText>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <DialogContentText>
                Enter your email to receive a one-time sign-in link. Your calculator history will
                sync across devices.
              </DialogContentText>
              <TextField
                autoFocus
                required
                type="email"
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                fullWidth
              />
              {error && <Alert severity="error">{error}</Alert>}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={submitting}>
            {sent ? 'Close' : 'Cancel'}
          </Button>
          {!sent && (
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send link'}
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default LoginDialog;
