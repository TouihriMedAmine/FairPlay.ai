
import React, { useMemo, useState } from 'react';
import SignInSide from './AuthPage';
import { BrowserRouter as Router, Route, Routes, Navigate} from 'react-router-dom';
import HeaderOnlyPage from './listpage';
import AnalysisPage from './AnalysisPage';
import { ThemeProvider, CssBaseline } from '@mui/material';
import getTheme from './theme';

function App() {
  // Detect system color scheme
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const [mode, setMode] = useState(prefersDarkMode ? 'dark' : 'light');
  const theme = useMemo(() => getTheme(mode), [mode]);

  // Pass setMode to pages that need the switch
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router basename="">
        <Routes>
          <Route path="/" element={<Navigate to="/authentication" />} />
          <Route path="/authentication" element={<SignInSide />} />
          <Route path="/home" element={<HeaderOnlyPage setMode={setMode} mode={mode}/>} />
          <Route path="/analysis" element={<AnalysisPage setMode={setMode} mode={mode}/>} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
