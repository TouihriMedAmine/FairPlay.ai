import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Button, CssBaseline, Grid, TextField, Typography, Paper,
  ThemeProvider, Avatar, Chip, Fade, Slide, IconButton, CircularProgress,
  Dialog, DialogContent, useMediaQuery
} from '@mui/material';
import {
  MusicNote, Person, Email, Lock, Visibility, VisibilityOff,
  AccountCircle, StarBorder, TrendingUp, Audiotrack, Brightness4, Brightness7
} from '@mui/icons-material';
import getTheme from './theme';
import image1 from './images/artist.jpg';
import image2 from './images/artist1.webp';
import image3 from './images/musicartist2.jpg';
import Logo from './images/Logo.png';
import { register, login } from './Services/auth-service';
import { jwtDecode } from 'jwt-decode';
import './autofill-fix.css';

export default function AuthPage() {
  const images = [image1, image2, image3];
  const location = useLocation();
  const navigate = useNavigate();
  const [slideIndex, setSlideIndex] = useState(0);
  const [showSignIn, setShowSignIn] = useState(true);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // const [isLoading, setIsLoading] = useState(false); // Commented out unused variable
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width:600px)');
  
  // Theme state management
  const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const [mode, setMode] = useState(prefersDarkMode ? 'dark' : 'light');
  const theme = useMemo(() => getTheme(mode), [mode]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % images.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [images.length]);

  // Check URL parameters to determine which form to show and whether to popup on mobile
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const mode = urlParams.get('mode');
    const popup = urlParams.get('popup');
    if (mode === 'signup') {
      setShowSignIn(false);
    } else {
      setShowSignIn(true); // Default to signin or if mode=signin
    }
    if (popup && isMobile) {
      setAuthDialogOpen(true);
    }
  }, [location.search, isMobile]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const userToken = localStorage.getItem("user");
    if (userToken) {
      try {
        const userData = JSON.parse(userToken);
        // Only redirect if user is actually authenticated (not a guest)
        if (userData.access && !userData.guest) {
          navigate('/home');
        }
      } catch (error) {
        // If there's an error parsing the token, remove it
        localStorage.removeItem("user");
      }
    }
    return () => { document.body.style.overflow = ''; };
  }, [navigate]);

  const handleSignInSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const username = data.get('username');
    const password = data.get('password');

    if (!username || !password) {
      setError("All fields are required");
      return;
    }

    try {
      const response = await login(username, password);
      if (response.access) {
        localStorage.setItem("user", JSON.stringify(response));
        console.log(jwtDecode(response.access));
        navigate('/home');
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('An error occurred during login');
      }
    }
  };

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSignUpLoading(true);
    const data = new FormData(e.currentTarget);

    const username = data.get('username')?.trim();
    const email = data.get('email')?.trim();
    const password = data.get('password');
    const confirmPassword = data.get('confirmPassword');

    if (!username || !email || !password || !confirmPassword) {
      setError("All fields are required");
      setSignUpLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      setSignUpLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setSignUpLoading(false);
      return;
    }

    try {
      const response = await register(username, email, password);
      if (response.success || response.access) {
        localStorage.setItem("user", JSON.stringify(response));
        navigate('/home');
      } else if (response.message) {
        setError(response.message);
      } else {
        setError("Registration failed");
      }
    } catch (err) {
      if (err.response?.data?.username?.[0]) {
        setError(`Username error: ${err.response.data.username[0]}`);
      } else if (err.response?.data?.email?.[0]) {
        setError(`Email error: ${err.response.data.email[0]}`);
      } else {
        setError("An error occurred during registration");
      }
    } finally {
      setSignUpLoading(false);
    }
  };

  // Reusable Auth Forms container (Sign In / Sign Up slider)
   const AuthForms = (
     <Box sx={{
       width: '100%',
       maxWidth: 500,
       position: 'relative',
       overflow: 'hidden',
       borderRadius: 4,
       zIndex: 1,
     }}>
      {/* Slide Container */}
      <Box sx={{
        display: 'flex',
        width: '200%',
        transform: showSignIn ? 'translateX(0%)' : 'translateX(-50%)',
        transition: 'transform 0.6s ease-in-out',
        height: '100%',
        borderRadius: 4,
      }}>
         {/* Sign In Form */}
         <Paper elevation={0} sx={{
           width: '50%',
           background: (theme) => theme.palette.mode === 'light' 
             ? '#E9E9E9'
             : 'linear-gradient(135deg, rgba(18,18,18,0.9) 0%, rgba(29,185,84,0.05) 100%)',
           border: (theme) => theme.palette.mode === 'light' 
             ? '1px solid rgba(0,0,0,0.1)' 
             : '1px solid rgba(255,255,255,0.1)',
           color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff',
           p: 3,
           display: 'flex',
           alignItems: 'center',
           justifyContent: 'center',
           flexDirection: 'column',
           borderRadius: 3,
         }}>
          <Slide direction="right" in={showSignIn} timeout={600}>
            <Box sx={{ width: '100%' }}>
               <Box sx={{ textAlign: 'center', mb: 2 }}>
                 <Avatar sx={{ 
                   bgcolor: '#1DB954', 
                   width: 48, 
                   height: 48, 
                   mx: 'auto', 
                   mb: 1.5,
                   boxShadow: '0 4px 20px rgba(29,185,84,0.3)'
                 }}>
                   <AccountCircle fontSize="large" />
                 </Avatar>
                <Typography variant="h4" gutterBottom sx={{ 
                  fontWeight: 'bold',
                  background: 'linear-gradient(45deg, #1DB954 30%, #1ed760 90%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  Welcome Back
                </Typography>
                <Typography variant="body2" sx={{ 
                  color: (theme) => theme.palette.mode === 'light' 
                    ? 'rgba(0,0,0,0.7)' 
                    : 'rgba(255,255,255,0.7)' 
                }}>
                  Sign in to continue to FairPlay AI
                </Typography>
              </Box>
              
              <form style={{ width: '100%' }} onSubmit={handleSignInSubmit}>
                {error && showSignIn && (
                  <Box sx={{ 
                    bgcolor: 'rgba(244,67,54,0.1)', 
                    border: '1px solid rgba(244,67,54,0.3)',
                    borderRadius: 2, 
                    p: 2, 
                    mb: 2 
                  }}>
                    <Typography color="error" variant="body2">{error}</Typography>
                  </Box>
                )}
                
                <TextField
                  name="username"
                  required
                  fullWidth
                  margin="normal"
                  variant="outlined"
                  label="Username"
                  autoComplete="username"
                  InputProps={{
                    startAdornment: <Person sx={{ color: '#1DB954', mr: 1 }} />,
                  }}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: (theme) => theme.palette.mode === 'light' 
                        ? 'rgba(255,255,255,0.9)' 
                        : 'rgba(255,255,255,0.05)',
                      backdropFilter: 'blur(5px)',
                      '& fieldset': { 
                        borderColor: (theme) => theme.palette.mode === 'light' 
                          ? 'rgba(0,0,0,0.23)' 
                          : 'rgba(255,255,255,0.2)' 
                      },
                      '&:hover fieldset': { borderColor: '#1DB954' },
                      '&.Mui-focused fieldset': { borderColor: '#1DB954' },
                      color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                      '& input': { 
                        color: (theme) => theme.palette.mode === 'light' 
                          ? '#000 !important' 
                          : '#fff !important' 
                      }
                    },
                    '& .MuiInputLabel-root': { 
                      color: (theme) => theme.palette.mode === 'light' 
                        ? 'rgba(0,0,0,0.6)' 
                        : 'rgba(255,255,255,0.7)' 
                    },
                    '& .MuiInputLabel-root.Mui-focused': { color: '#1DB954' },
                  }}
                />
                <TextField
                  name="password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  fullWidth
                  margin="normal"
                  variant="outlined"
                  label="Password"
                  autoComplete="current-password"
                  InputProps={{
                    startAdornment: <Lock sx={{ color: '#1DB954', mr: 1 }} />,
                    endAdornment: (
                      <Box 
                        onClick={() => setShowPassword(!showPassword)}
                        sx={{ cursor: 'pointer', color: '#1DB954' }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </Box>
                    )
                  }}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: (theme) => theme.palette.mode === 'light' 
                        ? 'rgba(255,255,255,0.9)' 
                        : 'rgba(255,255,255,0.05)',
                      backdropFilter: 'blur(5px)',
                      '& fieldset': { 
                        borderColor: (theme) => theme.palette.mode === 'light' 
                          ? 'rgba(0,0,0,0.23)' 
                          : 'rgba(255,255,255,0.2)' 
                      },
                      '&:hover fieldset': { borderColor: '#1DB954' },
                      '&.Mui-focused fieldset': { borderColor: '#1DB954' },
                      color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                      '& input': { 
                        color: (theme) => theme.palette.mode === 'light' 
                          ? '#000 !important' 
                          : '#fff !important' 
                      }
                    },
                    '& .MuiInputLabel-root': { 
                      color: (theme) => theme.palette.mode === 'light' 
                        ? 'rgba(0,0,0,0.6)' 
                        : 'rgba(255,255,255,0.7)' 
                    },
                    '& .MuiInputLabel-root.Mui-focused': { color: '#1DB954' },
                  }}
                />
                
                 <Button 
                   type="submit" 
                   fullWidth 
                   variant="contained"
                   disabled={false}
                   sx={{ 
                     mt: 2, 
                     mb: 1.5,
                     background: 'linear-gradient(45deg, #1DB954 30%, #1ed760 90%)',
                     color: '#fff',
                     fontWeight: 'bold',
                     textTransform: 'none',
                     py: 1.2,
                     borderRadius: 2,
                     boxShadow: '0 4px 20px rgba(29,185,84,0.3)',
                     '&:hover': {
                       background: 'linear-gradient(45deg, #1ed760 30%, #22c55e 90%)',
                       boxShadow: '0 6px 25px rgba(29,185,84,0.4)',
                       transform: 'translateY(-1px)',
                     },
                     '&:active': { transform: 'translateY(0)' },
                     transition: 'all 0.2s ease-in-out',
                   }}
                 >
                  {'Sign In'}
                </Button>
                
                <Typography sx={{ 
                  textAlign: 'center', 
                  color: (theme) => theme.palette.mode === 'light' 
                    ? 'rgba(0,0,0,0.7)' 
                    : 'rgba(255,255,255,0.7)' 
                }}>
                  Don't have an account?{' '}
                  <Button 
                    onClick={(e) => { e.preventDefault(); setError(null); setShowSignIn(false); }} 
                    sx={{ 
                      color: '#1DB954',
                      textTransform: 'none',
                      fontWeight: 'bold',
                      '&:hover': { backgroundColor: 'rgba(29,185,84,0.1)' }
                    }}
                  >
                    Sign Up
                  </Button>
                 </Typography>
                 
                 {/* Continue as Guest Option */}
                 <Box sx={{ mt: 2, textAlign: 'center' }}>
                   <Typography variant="body2" sx={{ color: (theme) => theme.palette.mode === 'light' 
                       ? 'rgba(0,0,0,0.5)' 
                       : 'rgba(255,255,255,0.5)', mb: 0.8 }}>
                     Want to explore first?
                   </Typography>
                   <Button
                     onClick={() => {
                       localStorage.setItem("user", JSON.stringify({ guest: true }));
                       navigate('/home');
                     }}
                     variant="outlined"
                     sx={{
                       color: '#ff9800',
                       borderColor: 'rgba(255,152,0,0.5)',
                       backgroundColor: 'rgba(255,152,0,0.05)',
                       textTransform: 'none',
                       fontWeight: 'bold',
                       borderRadius: 2,
                       py: 0.8,
                       '&:hover': {
                         backgroundColor: 'rgba(255,152,0,0.1)',
                         borderColor: '#ff9800',
                         transform: 'translateY(-1px)',
                       },
                       transition: 'all 0.2s ease-in-out',
                     }}
                   >
                     Continue as Guest
                   </Button>
                 </Box>
              </form>
            </Box>
          </Slide>
        </Paper>

         {/* Sign Up Form */}
         <Paper elevation={0} sx={{
           width: '50%',
           background: (theme) => theme.palette.mode === 'light' 
             ? '#E9E9E9'
             : 'linear-gradient(135deg, rgba(18,18,18,0.9) 0%, rgba(29,185,84,0.05) 100%)',
           border: (theme) => theme.palette.mode === 'light' 
             ? '1px solid rgba(0,0,0,0.1)' 
             : '1px solid rgba(255,255,255,0.1)',
           color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff',
           p: 3,
           display: 'flex',
           alignItems: 'center',
           justifyContent: 'center',
           flexDirection: 'column',
           borderRadius: 3,
         }}>
          <Slide direction="left" in={!showSignIn} timeout={600}>
            <Box sx={{ width: '100%' }}>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Avatar sx={{ 
                  bgcolor: '#1DB954', 
                  width: 48, 
                  height: 48, 
                  mx: 'auto', 
                  mb: 1.5,
                  boxShadow: '0 4px 20px rgba(29,185,84,0.3)'
                }}>
                  <Person fontSize="large" />
                </Avatar>
                <Typography variant="h4" gutterBottom sx={{ 
                  fontWeight: 'bold',
                  background: 'linear-gradient(45deg, #1DB954 30%, #1ed760 90%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  Join FairPlay AI
                </Typography>
                <Typography variant="body2" sx={{ 
                  color: (theme) => theme.palette.mode === 'light' 
                    ? 'rgba(0,0,0,0.7)' 
                    : 'rgba(255,255,255,0.7)' 
                }}>
                  Create your account to start tracking
                </Typography>
              </Box>
              
              <form style={{ width: '100%' }} onSubmit={handleSignUpSubmit}>
                {error && !showSignIn && (
                  <Box sx={{ 
                    bgcolor: 'rgba(244,67,54,0.1)', 
                    border: '1px solid rgba(244,67,54,0.3)',
                    borderRadius: 2, 
                    p: 2, 
                    mb: 2 
                  }}>
                    <Typography color="error" variant="body2">{error}</Typography>
                  </Box>
                )}
                
                <TextField
                  name="username"
                  required
                  fullWidth
                  margin="normal"
                  variant="outlined"
                  label="Username"
                  autoComplete="username"
                  InputProps={{
                    startAdornment: <Person sx={{ color: '#1DB954', mr: 1 }} />,
                  }}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: (theme) => theme.palette.mode === 'light' 
                        ? 'rgba(255,255,255,0.9)' 
                        : 'rgba(255,255,255,0.05)',
                      backdropFilter: 'blur(5px)',
                      '& fieldset': { 
                        borderColor: (theme) => theme.palette.mode === 'light' 
                          ? 'rgba(0,0,0,0.23)' 
                          : 'rgba(255,255,255,0.2)' 
                      },
                      '&:hover fieldset': { borderColor: '#1DB954' },
                      '&.Mui-focused fieldset': { borderColor: '#1DB954' },
                      color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                      '& input': { 
                        color: (theme) => theme.palette.mode === 'light' 
                          ? '#000 !important' 
                          : '#fff !important' 
                      }
                    },
                    '& .MuiInputLabel-root': { 
                      color: (theme) => theme.palette.mode === 'light' 
                        ? 'rgba(0,0,0,0.6)' 
                        : 'rgba(255,255,255,0.7)' 
                    },
                    '& .MuiInputLabel-root.Mui-focused': { color: '#1DB954' },
                  }}
                />
                <TextField
                  name="email"
                  required
                  type="email"
                  fullWidth
                  margin="normal"
                  variant="outlined"
                  label="Email"
                  autoComplete="email"
                  InputProps={{
                    startAdornment: <Email sx={{ color: '#1DB954', mr: 1 }} />,
                  }}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: (theme) => theme.palette.mode === 'light' 
                        ? 'rgba(255,255,255,0.9)' 
                        : 'rgba(255,255,255,0.05)',
                      backdropFilter: 'blur(5px)',
                      '& fieldset': { 
                        borderColor: (theme) => theme.palette.mode === 'light' 
                          ? 'rgba(0,0,0,0.23)' 
                          : 'rgba(255,255,255,0.2)' 
                      },
                      '&:hover fieldset': { borderColor: '#1DB954' },
                      '&.Mui-focused fieldset': { borderColor: '#1DB954' },
                      color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                      '& input': { 
                        color: (theme) => theme.palette.mode === 'light' 
                          ? '#000 !important' 
                          : '#fff !important' 
                      }
                    },
                    '& .MuiInputLabel-root': { 
                      color: (theme) => theme.palette.mode === 'light' 
                        ? 'rgba(0,0,0,0.6)' 
                        : 'rgba(255,255,255,0.7)' 
                    },
                    '& .MuiInputLabel-root.Mui-focused': { color: '#1DB954' },
                  }}
                />
                <TextField
                  name="password"
                  required
                  type={showSignUpPassword ? 'text' : 'password'}
                  fullWidth
                  margin="normal"
                  variant="outlined"
                  label="Password"
                  InputProps={{
                    startAdornment: <Lock sx={{ color: '#1DB954', mr: 1 }} />,
                    endAdornment: (
                      <IconButton
                        onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                        edge="end"
                        sx={{ color: '#1DB954' }}
                      >
                        {showSignUpPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    ),
                  }}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: (theme) => theme.palette.mode === 'light' 
                        ? 'rgba(255,255,255,0.9)' 
                        : 'rgba(255,255,255,0.05)',
                      backdropFilter: 'blur(5px)',
                      '& fieldset': { 
                        borderColor: (theme) => theme.palette.mode === 'light' 
                          ? 'rgba(0,0,0,0.23)' 
                          : 'rgba(255,255,255,0.2)' 
                      },
                      '&:hover fieldset': { borderColor: '#1DB954' },
                      '&.Mui-focused fieldset': { borderColor: '#1DB954' },
                      color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                      '& input': { 
                        color: (theme) => theme.palette.mode === 'light' 
                          ? '#000 !important' 
                          : '#fff !important' 
                      }
                    },
                    '& .MuiInputLabel-root': { 
                      color: (theme) => theme.palette.mode === 'light' 
                        ? 'rgba(0,0,0,0.6)' 
                        : 'rgba(255,255,255,0.7)' 
                    },
                    '& .MuiInputLabel-root.Mui-focused': { color: '#1DB954' },
                  }}
                />
                <TextField
                  name="confirmPassword"
                  required
                  type={showConfirmPassword ? 'text' : 'password'}
                  fullWidth
                  margin="normal"
                  variant="outlined"
                  label="Confirm Password"
                  InputProps={{
                    startAdornment: <Lock sx={{ color: '#1DB954', mr: 1 }} />,
                    endAdornment: (
                      <IconButton
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                        sx={{ color: '#1DB954' }}
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    ),
                  }}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: (theme) => theme.palette.mode === 'light' 
                        ? 'rgba(255,255,255,0.9)' 
                        : 'rgba(255,255,255,0.05)',
                      backdropFilter: 'blur(5px)',
                      '& fieldset': { 
                        borderColor: (theme) => theme.palette.mode === 'light' 
                          ? 'rgba(0,0,0,0.23)' 
                          : 'rgba(255,255,255,0.2)' 
                      },
                      '&:hover fieldset': { borderColor: '#1DB954' },
                      '&.Mui-focused fieldset': { borderColor: '#1DB954' },
                      color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                      '& input': { 
                        color: (theme) => theme.palette.mode === 'light' 
                          ? '#000 !important' 
                          : '#fff !important' 
                      }
                    },
                    '& .MuiInputLabel-root': { 
                      color: (theme) => theme.palette.mode === 'light' 
                        ? 'rgba(0,0,0,0.6)' 
                        : 'rgba(255,255,255,0.7)' 
                    },
                    '& .MuiInputLabel-root.Mui-focused': { color: '#1DB954' },
                  }}
                />
                 <Button 
                   type="submit" 
                   fullWidth 
                   variant="contained"
                   disabled={signUpLoading}
                   sx={{ 
                     mt: 2, 
                     py: 1.2,
                     bgcolor: '#1DB954',
                     fontSize: '1.1rem',
                     fontWeight: 600,
                     textTransform: 'none',
                     borderRadius: 2,
                     background: 'linear-gradient(45deg, #1DB954 30%, #1ed760 90%)',
                     color: '#fff',
                     fontWeight: 'bold',
                     '&:hover': {
                       background: 'linear-gradient(45deg, #1ed760 30%, #1DB954 90%)',
                       transform: 'translateY(-1px)',
                       boxShadow: '0 6px 20px rgba(29, 185, 84, 0.4)',
                     },
                     '&:active': { transform: 'translateY(0)' },
                     '&:disabled': { background: 'rgba(29, 185, 84, 0.3)' },
                     transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                   }}
                 >
                  {signUpLoading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Sign Up'}
                </Button>
                <Typography variant="body2" sx={{ 
                  mt: 1.5, 
                  textAlign: 'center', 
                  color: (theme) => theme.palette.mode === 'light' 
                    ? 'rgba(0,0,0,0.7)' 
                    : 'rgba(255,255,255,0.7)' 
                }}>
                  Already have an account?{' '}
                  <Button 
                    onClick={(e) => { e.preventDefault(); setError(null); setShowSignIn(true); }} 
                    sx={{ 
                      color: '#1DB954',
                      textTransform: 'none',
                      fontWeight: 600,
                      '&:hover': { backgroundColor: 'rgba(29, 185, 84, 0.1)' },
                    }}
                  >
                    Sign In
                  </Button>
                </Typography>
                
                {/* Continue as Guest Option */}
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: (theme) => theme.palette.mode === 'light' 
                      ? 'rgba(0,0,0,0.5)' 
                      : 'rgba(255,255,255,0.5)', mb: 0.8 }}>
                    Want to explore first?
                  </Typography>
                  <Button
                    onClick={() => {
                      localStorage.setItem("user", JSON.stringify({ guest: true }));
                      navigate('/home');
                    }}
                    variant="outlined"
                    sx={{
                      color: '#ff9800',
                      borderColor: 'rgba(255, 152, 0, 0.5)',
                      backgroundColor: 'rgba(255, 152, 0, 0.05)',
                      backdropFilter: 'blur(5px)',
                      textTransform: 'none',
                      fontWeight: 500,
                      borderRadius: 2,
                      py: 0.8,
                      '&:hover': {
                        backgroundColor: 'rgba(255, 152, 0, 0.1)',
                        borderColor: '#ff9800',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 15px rgba(255, 152, 0, 0.3)',
                      },
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    Continue as Guest
                  </Button>
                </Box>
              </form>
            </Box>
          </Slide>
        </Paper>
      </Box>
    </Box>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{
        height: '100vh',
        background: (theme) => theme.palette.mode === 'light' 
          ? '#ffffff'
          : 'linear-gradient(-45deg, #1DB954, #191414, #1ed760, #000000)',
        backgroundSize: '400% 400%',
        animation: (theme) => theme.palette.mode === 'light' ? 'none' : 'gradientShift 15s ease infinite',
        '@keyframes gradientShift': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Theme toggle button - top left */}
        <IconButton
          onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
          sx={{
            position: 'fixed',
            top: 16,
            left: 16,
            backgroundColor: (theme) => theme.palette.mode === 'light' 
              ? 'rgba(0,0,0,0.1)' 
              : 'rgba(255,255,255,0.1)',
            color: (theme) => theme.palette.mode === 'light' ? '#333' : '#fff',
            backdropFilter: 'blur(10px)',
            border: (theme) => theme.palette.mode === 'light' 
              ? '1px solid rgba(0,0,0,0.1)' 
              : '1px solid rgba(255,255,255,0.2)',
            zIndex: 1300,
            '&:hover': {
              backgroundColor: (theme) => theme.palette.mode === 'light' 
                ? 'rgba(0,0,0,0.15)' 
                : 'rgba(255,255,255,0.15)',
              transform: 'scale(1.05)',
            },
            transition: 'all 0.3s ease',
          }}
        >
          {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
        </IconButton>

        {/* Mobile top-right auth buttons */}
        <Box
          sx={{
            position: 'fixed',
            top: 12,
            right: 12,
            display: { xs: 'flex', sm: 'none' },
            gap: 1,
            zIndex: 10,
          }}
        >
          <Button
            size="small"
            variant="outlined"
            onClick={() => { setError(null); setShowSignIn(true); setAuthDialogOpen(true); }}
            sx={{
              textTransform: 'none',
              color: '#fff',
              borderColor: 'rgba(255,255,255,0.4)',
              backgroundColor: 'rgba(0,0,0,0.2)',
              '&:hover': { borderColor: '#1DB954', backgroundColor: 'rgba(29,185,84,0.1)' },
              backdropFilter: 'blur(4px)'
            }}
          >
            Sign in
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => { setError(null); setShowSignIn(false); setAuthDialogOpen(true); }}
            sx={{
              textTransform: 'none',
              background: 'linear-gradient(45deg, #1DB954 30%, #1ed760 90%)',
              color: '#fff',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(29,185,84,0.35)'
            }}
          >
            Sign up
          </Button>
        </Box>

        {/* Floating Music Notes Animation */}
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: 1,
        }}>
          {[...Array(6)].map((_, index) => (
            <MusicNote
              key={index}
              sx={{
                position: 'absolute',
                color: 'rgba(29, 185, 84, 0.1)',
                fontSize: { xs: '2rem', md: '3rem' },
                left: `${Math.random() * 100}%`,
                animationDelay: `${index * 2}s`,
                animation: 'float 20s linear infinite',
                '@keyframes float': {
                  '0%': { transform: 'translateY(100vh) rotate(0deg)', opacity: 0 },
                  '10%': { opacity: 1 },
                  '90%': { opacity: 1 },
                  '100%': { transform: 'translateY(-100px) rotate(360deg)', opacity: 0 },
                },
              }}
            />
          ))}
        </Box>

        <Grid container sx={{ height: '100vh', position: 'relative', zIndex: 2 }}>
          {/* Left Side - Background Slideshow */}
          <Grid item xs={false} sm={6} md={7} sx={{ position: 'relative', overflow: 'hidden' }}>
            <Box
              sx={{
                display: 'flex',
                width: `${images.length * 100}%`,
                height: '100%',
                transform: `translateX(-${slideIndex * (100 / images.length)}%)`,
                transition: 'transform 1s ease-in-out',
              }}
            >
              {images.map((img, idx) => (
                <Box
                  key={idx}
                  component="img"
                  src={img}
                  sx={{
                    width: `${100 / images.length}%`,
                    objectFit: 'cover',
                    height: '100vh',
                  }}
                />
              ))}
            </Box>

             {/* Modern Glassmorphism Overlay */}
             <Box
               sx={{
                 position: 'absolute',
                 top: 0, left: 0,
                 width: '100%', height: '100%',
                 background: (theme) => theme.palette.mode === 'light' 
                   ? 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(29,185,84,0.3) 100%)'
                   : 'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(29,185,84,0.3) 100%)',
                 backdropFilter: 'blur(2px)',
                 color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff',
                 display: 'flex',
                 flexDirection: 'column',
                 justifyContent: 'center',
                 alignItems: 'center',
                 textAlign: 'center',
                 px: 5
               }}
             >
              <Fade in timeout={1000}>
                <Box sx={{ mb: 4 }}>
                  <img src={Logo} alt="Logo" style={{ 
                    height: 100, 
                    marginBottom: 20,
                    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
                  }} />
                  <Typography variant="h3" gutterBottom sx={{ 
                    fontWeight: 'bold',
                    background: 'linear-gradient(45deg, #1DB954 30%, #1ed760 90%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 2
                  }}>
                    FairPlay AI
                  </Typography>
                  <Typography variant="h6" sx={{ 
                    color: 'rgba(255,255,255,0.9)', 
                    mb: 4,
                    fontWeight: 300,
                    maxWidth: 400
                  }}>
                    Discover who gets played and when. Track music plays across major Tunisian radios.
                  </Typography>
                  
                  {/* Feature Chips */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1, mb: 3 }}>
                    <Chip 
                      icon={<TrendingUp />} 
                      label="Real-time Analytics" 
                      sx={{ 
                        backgroundColor: 'rgba(29,185,84,0.2)', 
                        color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                        backdropFilter: 'blur(5px)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }} 
                    />
                    <Chip 
                      icon={<Audiotrack />} 
                      label="Music Tracking" 
                      sx={{ 
                        backgroundColor: 'rgba(29,185,84,0.2)', 
                        color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                        backdropFilter: 'blur(5px)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }} 
                    />
                    <Chip 
                      icon={<StarBorder />} 
                      label="Artist Insights" 
                      sx={{ 
                        backgroundColor: 'rgba(29,185,84,0.2)', 
                        color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                        backdropFilter: 'blur(5px)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }} 
                    />
                  </Box>
                </Box>
              </Fade>
            </Box>
          </Grid>

           {/* Right Side - Forms */}
           <Grid item xs={12} sm={6} md={5} sx={{
             background: (theme) => theme.palette.mode === 'light' 
               ? '#ffffff'
               : 'linear-gradient(135deg, rgba(18,18,18,0.95) 0%, rgba(0,0,0,0.98) 100%)',
             backdropFilter: 'blur(10px)',
             display: 'flex',
             justifyContent: 'center',
             alignItems: 'center',
             position: 'relative',
             overflow: 'hidden',
           }}>
             {/* Background Pattern */}
             <Box sx={{
               position: 'absolute',
               top: 0,
               left: 0,
               right: 0,
               bottom: 0,
               backgroundImage: (theme) => theme.palette.mode === 'light' 
                 ? 'radial-gradient(circle at 25% 25%, rgba(29,185,84,0.03) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(29,185,84,0.02) 0%, transparent 50%)'
                 : 'radial-gradient(circle at 25% 25%, rgba(29,185,84,0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(29,185,84,0.05) 0%, transparent 50%)',
               pointerEvents: 'none',
             }} />

            {/* Inline forms only on desktop/tablet */}
            {!isMobile && AuthForms}
          </Grid>
        </Grid>
      </Box>

      {/* Auth Forms Dialog on mobile - reuses the same container */}
      <Dialog
        open={isMobile && authDialogOpen}
        onClose={() => setAuthDialogOpen(false)}
        fullWidth
        maxWidth="xs"
         sx={{
           '& .MuiPaper-root': {
             background: (theme) => theme.palette.mode === 'light' 
               ? '#E9E9E9'
               : 'linear-gradient(135deg, rgba(18,18,18,0.95) 0%, rgba(29,185,84,0.12) 100%)',
             border: (theme) => theme.palette.mode === 'light' 
               ? '1px solid rgba(0,0,0,0.12)' 
               : '1px solid rgba(255,255,255,0.12)',
             color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff',
             backdropFilter: 'blur(10px)'
           }
         }}
      >
        <DialogContent sx={{ pt: 3 }}>
          {AuthForms}
        </DialogContent>
      </Dialog>
    </ThemeProvider>
  );
}
