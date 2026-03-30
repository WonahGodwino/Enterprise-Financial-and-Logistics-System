import React, { createContext, useState, useContext } from 'react';
import { Snackbar, Alert, Slide } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('info');
  const [toastKey, setToastKey] = useState(0);

  const showToast = (msg, sev = 'info') => {
    setMessage(msg);
    setSeverity(sev);
    setToastKey((prev) => prev + 1);
    setOpen(true);
  };

  const hideToast = (_event, reason) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  const toastIcon = severity === 'success'
    ? <CheckCircleIcon fontSize="inherit" />
    : severity === 'error'
      ? <ErrorIcon fontSize="inherit" />
      : severity === 'warning'
        ? <WarningIcon fontSize="inherit" />
        : <InfoIcon fontSize="inherit" />;

  const toastTitle = severity === 'success'
    ? 'Success'
    : severity === 'error'
      ? 'Action Failed'
      : severity === 'warning'
        ? 'Heads Up'
        : 'Info';

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Snackbar
        key={toastKey}
        open={open}
        autoHideDuration={3000}
        resumeHideDuration={3000}
        onClose={hideToast}
        TransitionComponent={Slide}
        TransitionProps={{ direction: 'left' }}
        disableWindowBlurListener
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={hideToast}
          severity={severity}
          variant="filled"
          icon={toastIcon}
          sx={{
            minWidth: 320,
            borderRadius: 2,
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.22)',
            '& .MuiAlert-icon': {
              fontSize: 22,
              alignItems: 'center',
            },
            '& .MuiAlert-message': {
              display: 'flex',
              flexDirection: 'column',
              gap: 0.3,
              padding: 0,
            },
          }}
        >
          <span style={{ fontWeight: 700, letterSpacing: 0.2 }}>{toastTitle}</span>
          <span>{message}</span>
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
};