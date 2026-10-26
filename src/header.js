import React, { useState, useEffect } from "react";
import { Brightness4, Brightness7 } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from "jwt-decode";
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { Menu as MenuIcon } from '@mui/icons-material';
// 👈 import your image
import SLOGAN from './images/Name-Slogon.png';

const Header = ({ onFilterMenuClick, isMobile, hideAuthActions, setMode, mode }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("user");
    if (token) {
      const userData = JSON.parse(token);
      if (userData.guest) {
        setCurrentUser("Guest");
        setIsGuest(true);
      } else {
        const decodedToken = jwtDecode(userData.access);
        setCurrentUser(decodedToken.username);
        setIsGuest(false);
      }
    } else {
      setCurrentUser(null);
      setIsGuest(false);
      navigate("/authentication");
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setCurrentUser(null);
    setIsGuest(false);
    navigate("/authentication");
  };

  const handleLogin = () => {
    navigate("/authentication?mode=signin");
  };

  const handleSignUp = () => {
    navigate("/authentication?mode=signup");
  };

  return (
    <AppBar position="fixed" sx={{ 
      background: (theme) => theme.palette.mode === 'light' 
        ? 'linear-gradient(180deg, #f7f7f7 0%, #E9E9E9 100%)' 
        : '#0a0a0a',
      color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff',
      boxShadow: 'none',
      borderBottom: (theme) => theme.palette.mode === 'light' ? '1px solid #e5e7eb' : '1px solid rgba(255, 255, 255, 0.1)',
      zIndex: 1201, 
      paddingBottom: '20px',
      pointerEvents: 'auto'
    }}>
      <Toolbar sx={{ 
        position: 'relative', 
        display: 'flex', 
        justifyContent: 'space-between',
        paddingTop: '20px',
        pointerEvents: 'auto'
      }}>
        {/* Left: Username (hidden on mobile) or Filter Menu Button */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center',
          pointerEvents: 'auto'
        }}>
          {onFilterMenuClick ? (
            <IconButton
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Filter menu button clicked!');
                onFilterMenuClick();
              }}
              sx={{
                color: '#1DB954',
                display: { xs: 'flex', md: 'none' },
                zIndex: 1300,
                minWidth: '48px',
                minHeight: '48px',
                pointerEvents: 'auto',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'rgba(29, 185, 84, 0.1)',
                },
                '&:active': {
                  backgroundColor: 'rgba(29, 185, 84, 0.2)',
                },
              }}
            >
              <MenuIcon sx={{ fontSize: '24px' }} />
            </IconButton>
          ) : null}
          
          <Typography variant="h6" sx={{ display: { xs: 'none', md: 'block' } }}>
            Hello, {currentUser}!
            {currentUser === "Guest" && (
                <Typography 
                  component="span" 
                  variant="caption" 
                  sx={{ 
                    ml: 1, 
                    backgroundColor: '#ff9800', 
                    color: '#000', 
                    px: 1, 
                    py: 0.5, 
                    borderRadius: 1,
                    fontSize: '0.7rem'
                  }}
                >
                  GUEST
                </Typography>
              )}
            </Typography>
        </Box>

        {/* Center: Image with slogan */}
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            zIndex: 1200,
            pointerEvents: 'none', // Allow clicks to pass through
          }}
        >
          <img 
            src={SLOGAN} 
            alt="FairPlay AI Slogan" 
            style={{ 
              height: '80px',
              pointerEvents: 'none' // Ensure image doesn't block clicks
            }} 
          />
        </Box>

        {/* Right: Theme Switch + Authentication Actions */}
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 1, alignItems: 'center' }}>
          {/* Theme Switch Button */}
          {setMode && (
            <IconButton
              sx={{ ml: 1 }}
              onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
              color="inherit"
            >
              {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          )}
          {/* Hide all auth actions (Login, Signup, Logout) if hideAuthActions is true */}
          {hideAuthActions ? null : (
            isGuest ? (
              <>
                <Button
                  onClick={handleLogin}
                  sx={{
                    color: '#1DB954',
                    textTransform: 'none',
                    fontSize: '16px',
                    '&:hover': {
                      backgroundColor: 'rgba(29, 185, 84, 0.1)',
                    },
                  }}
                >
                  Login
                </Button>
                <Button
                  onClick={handleSignUp}
                  sx={{
                    backgroundColor: '#1DB954',
                    color: '#fff',
                    borderRadius: '10px',
                    '&:hover': {
                      backgroundColor: '#1ed760',
                    },
                    textTransform: 'none',
                    px: 2,
                    fontSize: '16px',
                  }}
                >
                  Sign Up
                </Button>
              </>
            ) : (
              // Authenticated user: Show Logout button
              <Button
                onClick={handleLogout}
                sx={{
                  backgroundColor: 'rgba(255, 23, 68, 0.3)',
                  backdropFilter: 'blur(10px)',
                  color: '#fff',
                  borderRadius: '25px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  opacity: 0.8,
                  '&:hover': {
                    backgroundColor: 'rgba(255, 23, 68, 0.95)',
                    opacity: 1,
                    transform: 'translateY(-1px) scale(1.02)',
                    boxShadow: '0 12px 28px rgba(255, 23, 68, 0.4), 0 0 20px rgba(255, 23, 68, 0.6)',
                  },
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  textTransform: 'none',
                  px: 3,
                  py: 1,
                  fontSize: '14px',
                  fontWeight: '500',
                  minWidth: '100px',
                  boxShadow: '0 4px 12px rgba(255, 23, 68, 0.2)',
                  display: { xs: 'none', md: 'inline-flex' }, // Hide on phone size
                }}
              >
                Logout
              </Button>
            )
          )}
        </Box>

      </Toolbar>
    </AppBar>
  );
};

export default Header;
