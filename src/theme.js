import { createTheme } from '@mui/material/styles';

const getTheme = (mode) => createTheme({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
          background: {
            default: '#f5f5f5',
            paper: '#fff',
          },
          primary: { main: '#1DB954' },
          secondary: { main: '#ff1744' },
        }
      : {
          background: {
            default: '#121212',
            paper: '#1e1e1e',
          },
          primary: { main: '#1DB954' },
          secondary: { main: '#ff1744' },
        }),
  },
});

export default getTheme;
