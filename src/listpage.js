import * as React from 'react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from './config';
import {
  Card, CardContent, Typography, Box, Container, Grid, Paper, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, FormControl, InputLabel, Select, MenuItem,
  Drawer, IconButton, Fab, useMediaQuery, useTheme, Link
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Header from './header';
// import { jwtDecode } from 'jwt-decode'; // Commented out unused import
import Footer from './Footer';

import IFM from './images/IFM.png';
import Mosaique_FM from './images/Mosaique_FM.png';
import Jawhara_FM from './images/Jawhara_FM.jpg';
import Express_FM from './images/ExpressFM.png';
import RadioNat from './images/RadioNat.png';
import Knooz_FM from './images/knooz_fm.png';
import Radio_Jeunes from './images/radio-jeunes-tunisie.png';
import Zaitouna_FM from './images/zitouna_fm.png';
import RTCI from './images/RTCI_logo.png';
import Radio_Sfax from './images/radio_sfax.png';
import Radio_Monastir from './images/radio_mfm.png';
import Oxygene_FM from './images/OxyNewLogo1602.png';
import Radio_Le_Kef from './images/radio_le_kef.png';
import Culturelle_RT from './images/Logo.png';
import Misk_FM from './images/misk_fm.jpg';
import France_Inter from './images/France_Inter.png';
import Logo from './images/Logo.png';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import diwan_fm from './images/diwan_fm.png';
// import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'; // Commented out unused import

const HeaderOnlyPage = ({ setMode, mode }) => {
  const [songs, setSongs] = useState([]);
  const [allSongs, setAllSongs] = useState([]);
  // const [currentUser, setCurrentUser] = useState(null); // Commented out unused variable
  const [isGuest, setIsGuest] = useState(false);
  const [artists, setArtists] = useState([]);
  const [stations, setStations] = useState([]);
  const [selectedArtist, setSelectedArtist] = useState('All Artists');
  const [selectedStation, setSelectedStation] = useState('All Stations');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  
  // Responsive design states
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("user");
    if (token) {
      const userData = JSON.parse(token);
      if (userData.guest) {
        // setCurrentUser("Guest"); // Removed unused variable
        setIsGuest(true);
      } else {
        // const decodedToken = jwtDecode(userData.access); // Commented out unused variable
        // setCurrentUser(decodedToken.username); // Removed unused variable
        setIsGuest(false);
      }
    }
  }, []);

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        const response = await axios.get(API_ENDPOINTS.SONGS);
        const allData = response.data;
        setAllSongs(allData);
        setSongs(allData); // default

        const uniqueArtists = [...new Set(allData.map(song => song.artist))];
        setArtists(['All Artists', ...uniqueArtists]);
        
        const uniqueStations = [...new Set(allData.map(song => song.radio_name).filter(Boolean))];
        setStations(['All Stations', ...uniqueStations]);
      } catch (error) {
        console.error("Error fetching songs:", error);
      }
    };

    fetchSongs();
  }, []);

  // Handle scroll for back to top button
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setShowBackToTop(scrollTop > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleArtistClick = (artist) => {
    if (!checkFeatureAccess('Artist Filtering')) return;
    
    setSelectedArtist(artist);
    applyFilters(artist, selectedStation, startDate, endDate, startTime, endTime);
  };

  const handleStationChange = (station) => {
    if (!checkFeatureAccess('Station Filtering')) return;
    
    setSelectedStation(station);
    applyFilters(selectedArtist, station, startDate, endDate, startTime, endTime);
  };

  // const handleDateTimeChange = () => {
  //   if (!checkFeatureAccess('Date/Time Filtering')) return;
  //   
  //   applyFilters(selectedArtist, selectedStation, startDate, endDate, startTime, endTime);
  // }; // Commented out unused function

  const clearAllFilters = () => {
    if (!checkFeatureAccess('Clear Filters')) return;
    
    setSelectedArtist('All Artists');
    setSelectedStation('All Stations');
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
    setSearchQuery('');
    setSongs(allSongs); // Reset to show all songs
  };

  const applyFilters = (artist, station, sDate, eDate, sTime, eTime) => {
    let filtered = allSongs;

    // Filter by artist
    if (artist !== 'All Artists') {
      filtered = filtered.filter(song => song.artist === artist);
    }

    // Filter by station
    if (station !== 'All Stations') {
      filtered = filtered.filter(song => song.radio_name === station);
    }

    // Filter by date - handle individual dates properly
    if (sDate || eDate) {
      filtered = filtered.filter(song => {
        const songDate = new Date(song.timestamp);
        
        // If both dates are provided, filter within range
        if (sDate && eDate) {
          const startDateTime = new Date(sDate + 'T00:00:00');
          const endDateTime = new Date(eDate + 'T23:59:59');
          return songDate >= startDateTime && songDate <= endDateTime;
        }
        
        // If only start date is provided - filter from start date onwards
        if (sDate && !eDate) {
          const startDateTime = new Date(sDate + 'T00:00:00');
          return songDate >= startDateTime;
        }
        
        // If only end date is provided - filter up to end date
        if (!sDate && eDate) {
          const endDateTime = new Date(eDate + 'T23:59:59');
          return songDate <= endDateTime;
        }
        
        return true;
      });
    }

    // Filter by time range
    if (sTime && eTime) {
      filtered = filtered.filter(song => {
        //filter by time range if both start time and end time are provided
        //filter by time range if only start time is provided
        //filter by time range if only end time is provided
        const songTime = new Date(song.timestamp).toTimeString().slice(0, 5);
        if (sTime && eTime) {
          return songTime >= sTime && songTime <= eTime;
        }
        if (sTime && !eTime) {
          return songTime >= sTime;
        }
        if (!sTime && eTime) {
          return songTime <= eTime;
        }
        return true; // Return true for all other cases
      });
    }

    setSongs(filtered);
  };

  const getRadioImage = (radioName) => {
    switch (radioName) {
      case 'France Inter': return France_Inter;
      case 'Mosaique FM': return Mosaique_FM;
      case 'Radio Nationale': return RadioNat;
      case 'Diwan FM': return diwan_fm; // Using default logo
      case 'Zaitouna FM': return Zaitouna_FM;
      case 'Express FM': return Express_FM;
      case 'Radio Jeunes': return Radio_Jeunes;
      case 'RTCI': return RTCI;
      case 'Radio Sfax': return Radio_Sfax;
      case 'Radio Monastir': return Radio_Monastir;
      case 'Oxygene FM': return Oxygene_FM;
      case 'Radio Le Kef': return Radio_Le_Kef;
      case 'Culturelle RT': return Culturelle_RT;
      case 'Knooz FM': return Knooz_FM;
      case 'Misk FM': return Misk_FM;
      case 'IFM': return IFM;
      case 'Jawhara FM': return Jawhara_FM;
      default: return Logo; // Default logo for any unmatched stations
    }
  };

  const filteredSongs = songs.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.album.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.radio_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const checkFeatureAccess = (featureName) => {
    if (isGuest) {
      setShowGuestDialog(true);
      return false;
    }
    return true;
  };

  const handleAnalyze = () => {
    if (!checkFeatureAccess('Analytics Dashboard')) return;
    navigate('/analysis');
  };

  const handlePrint = () => {
    if (!checkFeatureAccess('Print Report')) return;
    
    const doc = new jsPDF();
    const title = `FairPlay AI - Songs Report (Artist: ${selectedArtist}, Station: ${selectedStation})`;

    doc.setFontSize(16);
    doc.text(title, 14, 20);

    autoTable(doc, {
      startY: 30,
      head: [['Title', 'Album', 'Artist', 'Radio Name', 'Timestamp']],
      body: filteredSongs.map(song => [
        song.title,
        song.album,
        song.artist,
        song.radio_name || '',
        new Date(song.timestamp).toLocaleString()
      ]),
    });

    doc.save('songs_report.pdf');
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };



  return (
    <>

      {/* Header: hide all auth actions (Login, Signup, Logout) on mobile (when hamburger/drawer is present) */}
      <Header 
        onFilterMenuClick={() => setFilterDrawerOpen(!filterDrawerOpen)}
        isMobile={isMobile}
        hideAuthActions={isMobile}
        setMode={setMode}
        mode={mode}
      />

      <Drawer
        anchor="left"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: 300,
            background: (theme) => theme.palette.mode === 'light' 
              ? 'linear-gradient(180deg, #f7f7f7 0%, #E9E9E9 100%)' 
              : '#0a0a0a',
            color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff',
            top: '88px',
            height: 'calc(100vh - 88px)',
            borderTop: (theme) => theme.palette.mode === 'light' ? '1px solid #e5e7eb' : '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          },
        }}
      >
        <Box sx={{ p: 2, pt: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Auth actions for guest in drawer on mobile */}
          {isGuest && isMobile && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
              <Button
                onClick={() => {
                  setFilterDrawerOpen(false);
                  navigate('/authentication?mode=signin');
                }}
                sx={{
                  color: '#1DB954',
                  textTransform: 'none',
                  fontSize: '16px',
                  '&:hover': { backgroundColor: 'rgba(29, 185, 84, 0.1)' },
                }}
              >
                Login
              </Button>
              <Button
                onClick={() => {
                  setFilterDrawerOpen(false);
                  navigate('/authentication?mode=signup');
                }}
                sx={{
                  backgroundColor: '#1DB954',
                  color: '#fff',
                  borderRadius: '10px',
                  '&:hover': { backgroundColor: '#1ed760' },
                  textTransform: 'none',
                  px: 2,
                  fontSize: '16px',
                }}
              >
                Sign Up
              </Button>
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              Filters {isGuest && <span style={{ fontSize: '0.8rem', color: '#ff9800' }}>(Click to try)</span>}
            </Typography>
            <IconButton onClick={() => setFilterDrawerOpen(false)} sx={{ color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff' }}>
              ✕
            </IconButton>
          </Box>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1}}>
            {/* ...existing filter controls... */}
            <FormControl fullWidth>
              <InputLabel id="artist-label" sx={{ color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff', fontWeight: 'bold' }}>Artist</InputLabel>
              <Select
                labelId="artist-label"
                id="artist-select"
                label="Artist"
                value={selectedArtist}
                onChange={(e) => handleArtistClick(e.target.value)}
                sx={{
                  color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                  backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  borderRadius: 1,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                    '& fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.23)' : '#555',
                      borderWidth: '1px',
                    },
                    '&:hover fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  },
                  '& .MuiSelect-icon': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                  },
                  '& .MuiInputLabel-root': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    fontWeight: 'bold',
                  },
                }}
              >
                <MenuItem value="All Artists">All Artists</MenuItem>
                {artists.slice(1).map((artist, index) => (
                  <MenuItem key={index} value={artist}>
                    {artist}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="station-label" sx={{ color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff', fontWeight: 'bold' }}>Radio Station</InputLabel>
              <Select
                labelId="station-label"
                id="station-select"
                label="Radio Station"
                value={selectedStation}
                onChange={(e) => handleStationChange(e.target.value)}
                sx={{
                  color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                  backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  borderRadius: 1,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                    '& fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.23)' : '#555',
                      borderWidth: '1px',
                    },
                    '&:hover fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  },
                  '& .MuiSelect-icon': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                  },
                  '& .MuiInputLabel-root': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    fontWeight: 'bold',
                  },
                }}
              >
                <MenuItem value="All Stations">All Stations</MenuItem>
                {stations.slice(1).map((station, index) => (
                  <MenuItem key={index} value={station}>
                    {station}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ position: 'relative' }}>
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => {
                if (isGuest) {
                  setShowGuestDialog(true);
                  return;
                }
                setStartDate(e.target.value);
                setTimeout(() => {
                  applyFilters(selectedArtist, selectedStation, e.target.value, endDate, startTime, endTime);
                }, 10);
              }}
              InputLabelProps={{
                shrink: true,
                sx: { color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff', fontWeight: 'bold' }
              }}
              sx={{
                width: '100%',
                backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                borderRadius: 1,
                '& .MuiOutlinedInput-root': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                  backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  '& fieldset': {
                    borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#555',
                    borderWidth: '1px',
                  },
                  '&:hover fieldset': {
                    borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                    borderWidth: '1px',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                    borderWidth: '1px',
                  },
                },
                '& input': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                  WebkitTextFillColor: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-text': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-month-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-day-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-year-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-hour-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-minute-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-ampm-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& .MuiInputBase-input': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                  backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  '&::-webkit-calendar-picker-indicator': {
                    filter: (theme) => theme.palette.mode === 'light' ? 'invert(0)' : 'invert(1)',
                    cursor: 'pointer',
                  },
                },
              }}
            />
            {startDate && (
              <Box
                onClick={() => {
                  if (isGuest) {
                    setShowGuestDialog(true);
                    return;
                  }
                  setStartDate('');
                  setTimeout(() => {
                    applyFilters(selectedArtist, selectedStation, '', endDate, startTime, endTime);
                  }, 10);
                }}
                sx={{
                  position: 'absolute',
                  right: 40,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'pointer',
                  color: '#ff6b6b',
                  fontSize: '18px',
                  '&:hover': {
                    color: '#ff8a8a',
                    transform: 'translateY(-50%) scale(1.1)',
                  },
                  transition: 'all 0.2s ease',
                  zIndex: 10,
                }}
              >
                ✕
              </Box>
            )}
          </Box>

          <Box sx={{ position: 'relative' }}>
            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => {
                if (isGuest) {
                  setShowGuestDialog(true);
                  return;
                }
                setEndDate(e.target.value);
                setTimeout(() => {
                  applyFilters(selectedArtist, selectedStation, startDate, e.target.value, startTime, endTime);
                }, 10);
              }}
              InputLabelProps={{
                shrink: true,
                sx: { color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff', fontWeight: 'bold' }
              }}
              sx={{
                width: '100%',
                backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                borderRadius: 1,
                '& .MuiOutlinedInput-root': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                  backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  '& fieldset': {
                    borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#555',
                    borderWidth: '2px',
                  },
                  '&:hover fieldset': {
                    borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                    borderWidth: '2px',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                    borderWidth: '2px',
                  },
                },
                '& input': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                  WebkitTextFillColor: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-text': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-month-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-day-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-year-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-hour-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-minute-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-ampm-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& .MuiInputBase-input': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                  backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  '&::-webkit-calendar-picker-indicator': {
                    filter: (theme) => theme.palette.mode === 'light' ? 'invert(0)' : 'invert(1)',
                    cursor: 'pointer',
                  },
                },
              }}
            />
            {endDate && (
              <Box
                onClick={() => {
                  if (isGuest) {
                    setShowGuestDialog(true);
                    return;
                  }
                  setEndDate('');
                  setTimeout(() => {
                    applyFilters(selectedArtist, selectedStation, startDate, '', startTime, endTime);
                  }, 10);
                }}
                sx={{
                  position: 'absolute',
                  right: 40,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'pointer',
                  color: '#ff6b6b',
                  fontSize: '18px',
                  '&:hover': {
                    color: '#ff8a8a',
                    transform: 'translateY(-50%) scale(1.1)',
                  },
                  transition: 'all 0.2s ease',
                  zIndex: 10,
                }}
              >
                ✕
              </Box>
            )}
          </Box>

          <Box sx={{ position: 'relative' }}>
            <TextField
              label="Start Time"
              type="time"
              value={startTime}
              onChange={(e) => {
                if (isGuest) {
                  setShowGuestDialog(true);
                  return;
                }
                setStartTime(e.target.value);
                setTimeout(() => {
                  applyFilters(selectedArtist, selectedStation, startDate, endDate, e.target.value, endTime);
                }, 10);
              }}
              InputLabelProps={{
                shrink: true,
                sx: { color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff', fontWeight: 'bold' }
              }}
              sx={{
                width: '100%',
                backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                borderRadius: 1,
                '& .MuiOutlinedInput-root': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                  backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  '& fieldset': {
                    borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#555',
                    borderWidth: '2px',
                  },
                  '&:hover fieldset': {
                    borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                    borderWidth: '2px',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                    borderWidth: '2px',
                  },
                },
                '& input': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                  WebkitTextFillColor: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-text': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-month-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-day-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-year-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-hour-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-minute-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-ampm-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& .MuiInputBase-input': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                  backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  '&::-webkit-calendar-picker-indicator': {
                    filter: (theme) => theme.palette.mode === 'light' ? 'invert(0)' : 'invert(1)',
                    cursor: 'pointer',
                  },
                },
              }}
            />
            {startTime && (
              <Box
                onClick={() => {
                  if (isGuest) {
                    setShowGuestDialog(true);
                    return;
                  }
                  setStartTime('');
                  setTimeout(() => {
                    applyFilters(selectedArtist, selectedStation, startDate, endDate, '', endTime);
                  }, 10);
                }}
                sx={{
                  position: 'absolute',
                  right: 40,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'pointer',
                  color: '#ff6b6b',
                  fontSize: '18px',
                  '&:hover': {
                    color: '#ff8a8a',
                    transform: 'translateY(-50%) scale(1.1)',
                  },
                  transition: 'all 0.2s ease',
                  zIndex: 10,
                }}
              >
                ✕
              </Box>
            )}
          </Box>

          <Box sx={{ position: 'relative' }}>
            <TextField
              label="End Time"
              type="time"
              value={endTime}
              onChange={(e) => {
                if (isGuest) {
                  setShowGuestDialog(true);
                  return;
                }
                setEndTime(e.target.value);
                setTimeout(() => {
                  applyFilters(selectedArtist, selectedStation, startDate, endDate, startTime, e.target.value);
                }, 10);
              }}
              InputLabelProps={{
                shrink: true,
                sx: { color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff', fontWeight: 'bold' }
              }}
              sx={{
                width: '100%',
                backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                borderRadius: 1,
                '& .MuiOutlinedInput-root': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                  backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  '& fieldset': {
                    borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#555',
                    borderWidth: '2px',
                  },
                  '&:hover fieldset': {
                    borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                    borderWidth: '2px',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                    borderWidth: '2px',
                  },
                },
                '& input': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                  WebkitTextFillColor: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-text': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-month-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-day-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-year-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-hour-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-minute-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& input::-webkit-datetime-edit-ampm-field': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                },
                '& .MuiInputBase-input': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                  backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  '&::-webkit-calendar-picker-indicator': {
                    filter: (theme) => theme.palette.mode === 'light' ? 'invert(0)' : 'invert(1)',
                    cursor: 'pointer',
                  },
                },
              }}
            />
            {endTime && (
              <Box
                onClick={() => {
                  if (isGuest) {
                    setShowGuestDialog(true);
                    return;
                  }
                  setEndTime('');
                  setTimeout(() => {
                    applyFilters(selectedArtist, selectedStation, startDate, endDate, startTime, '');
                  }, 10);
                }}
                sx={{
                  position: 'absolute',
                  right: 40,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'pointer',
                  color: '#ff6b6b',
                  fontSize: '18px',
                  '&:hover': {
                    color: '#ff8a8a',
                    transform: 'translateY(-50%) scale(1.1)',
                  },
                  transition: 'all 0.2s ease',
                  zIndex: 10,
                }}
              >
                ✕
              </Box>
            )}
          </Box>

            
            <Button
              fullWidth
              variant="outlined"
              onClick={clearAllFilters}
              sx={{
                color: '#ff6b6b',
                borderColor: '#ff6b6b',
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                fontWeight: 'bold',
                textTransform: 'none',
                px: 3,
                py: 1,
                '&:hover': {
                  backgroundColor: 'rgba(255, 107, 107, 0.2)',
                  borderColor: '#ff8a8a',
                  color: '#ff8a8a',
                },
                '&:active': {
                  backgroundColor: 'rgba(255, 107, 107, 0.3)',
                },
              }}
            >
              🗑️ Clear All Filters
            </Button>
            {/* Logout at the very bottom of the drawer for authenticated users on mobile */}
            {!isGuest && isMobile && (
              <Box sx={{ mt: 2, mb: 6 }}>
                <Button
                  fullWidth
                  onClick={() => {
                    setFilterDrawerOpen(false);
                    localStorage.removeItem('user');
                    localStorage.removeItem('guestMode');
                    navigate('/authentication');
                  }}
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
                  }}
                >
                  Logout
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      </Drawer>

      <Box
        sx={{
          background: (theme) => theme.palette.mode === 'light'
            ? 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.95) 100%)'
            : 'linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0.9) 100%)',
          minHeight: '100vh',
          pt: '100px',
          pb: 2,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: { xs: 'center', md: 'flex-start' },
          alignItems: { xs: 'center', md: 'flex-start' },
        }}
      >
        {/* Desktop Left panel: Filter Controls */}
        <Paper elevation={0}
          sx={{
            display: { xs: 'none', md: 'block' },
            width: 280,
            minHeight: '85vh', // Added minimum height to make filters container taller
            ml: 4,
            mr: 2,
            background: (theme) => theme.palette.mode === 'light' 
              ? 'linear-gradient(180deg, #f7f7f7 0%, #E9E9E9 100%)' 
              : '#0a0a0a',
            color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff',
            border: (theme) => theme.palette.mode === 'light' ? '1px solid #e5e7eb' : '1px solid rgba(255, 255, 255, 0.1)',
            p: 2,
          }}
        >
          <Typography variant="h6" sx={{ mb: 3, textAlign: 'center' }}>
            Filters {isGuest && <span style={{ fontSize: '0.8rem', color: '#ff9800' }}>(Click to try)</span>}
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="desktop-artist-label" sx={{ color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff', fontWeight: 'bold' }}>Artist</InputLabel>
              <Select
                labelId="desktop-artist-label"
                id="desktop-artist-select"
                label="Artist"
                value={selectedArtist}
                onChange={(e) => handleArtistClick(e.target.value)}
                sx={{
                  color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                  backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  borderRadius: 1,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                    '& fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.23)' : '#555',
                      borderWidth: '1px',
                    },
                    '&:hover fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  },
                  '& .MuiInputLabel-root': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    fontWeight: 'bold',
                  },
                }}
              >
                {artists.map((artist) => (
                  <MenuItem key={artist} value={artist}>
                    {artist}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth variant="outlined">
              <InputLabel id="desktop-station-label" sx={{ color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff', fontWeight: 'bold' }}>Radio Station</InputLabel>
              <Select
                labelId="desktop-station-label"
                id="desktop-station-select"
                label="Radio Station"
                value={selectedStation}
                onChange={(e) => handleStationChange(e.target.value)}
                sx={{
                  color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                  backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  borderRadius: 1,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                    '& fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.23)' : '#555',
                      borderWidth: '1px',
                    },
                    '&:hover fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  },
                  '& .MuiInputLabel-root': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    fontWeight: 'bold',
                  },
                }}
              >
                {stations.map((station) => (
                  <MenuItem key={station} value={station}>
                    {station}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ position: 'relative' }}>
              <TextField
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  if (isGuest) {
                    setShowGuestDialog(true);
                    return;
                  }
                  setStartDate(e.target.value);
                  // Apply filters immediately when start date changes
                  setTimeout(() => {
                    applyFilters(selectedArtist, selectedStation, e.target.value, endDate, startTime, endTime);
                  }, 10);
                }}
                InputLabelProps={{
                  shrink: true,
                  sx: { color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff' }
                }}
                sx={{
                  width: '100%',
                  backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  borderRadius: 1,
                  '& .MuiOutlinedInput-root': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                    '& fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#555',
                      borderWidth: '1px',
                    },
                    '&:hover fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                    '&::-webkit-calendar-picker-indicator': {
                      filter: (theme) => theme.palette.mode === 'light' ? 'invert(0)' : 'invert(1)',
                      cursor: 'pointer',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    fontWeight: 'bold',
                  },
                }}
              />
              {startDate && (
                <Box
                  onClick={() => {
                    if (isGuest) {
                      setShowGuestDialog(true);
                      return;
                    }
                    setStartDate('');
                    setTimeout(() => {
                      applyFilters(selectedArtist, selectedStation, '', endDate, startTime, endTime);
                    }, 10);
                  }}
                  sx={{
                    position: 'absolute',
                    right: 40,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer',
                    color: '#ff6b6b',
                    fontSize: '18px',
                    '&:hover': {
                      color: '#ff8a8a',
                      transform: 'translateY(-50%) scale(1.1)',
                    },
                    transition: 'all 0.2s ease',
                    zIndex: 10,
                  }}
                >
                  ✕
                </Box>
              )}
            </Box>

            <Box sx={{ position: 'relative' }}>
              <TextField
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  if (isGuest) {
                    setShowGuestDialog(true);
                    return;
                  }
                  setEndDate(e.target.value);
                  // Apply filters immediately when end date changes
                  setTimeout(() => {
                    applyFilters(selectedArtist, selectedStation, startDate, e.target.value, startTime, endTime);
                  }, 10);
                }}
                InputLabelProps={{
                  shrink: true,
                  sx: { color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff' }
                }}
                sx={{
                  width: '100%',
                  backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  borderRadius: 1,
                  '& .MuiOutlinedInput-root': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                    '& fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#555',
                      borderWidth: '1px',
                    },
                    '&:hover fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                    '&::-webkit-calendar-picker-indicator': {
                      filter: (theme) => theme.palette.mode === 'light' ? 'invert(0)' : 'invert(1)',
                      cursor: 'pointer',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    fontWeight: 'bold',
                  },
                }}
              />
              {endDate && (
                <Box
                  onClick={() => {
                    if (isGuest) {
                      setShowGuestDialog(true);
                      return;
                    }
                    setEndDate('');
                    setTimeout(() => {
                      applyFilters(selectedArtist, selectedStation, startDate, '', startTime, endTime);
                    }, 10);
                  }}
                  sx={{
                    position: 'absolute',
                    right: 40,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer',
                    color: '#ff6b6b',
                    fontSize: '18px',
                    '&:hover': {
                      color: '#ff8a8a',
                      transform: 'translateY(-50%) scale(1.1)',
                    },
                    transition: 'all 0.2s ease',
                    zIndex: 10,
                  }}
                >
                  ✕
                </Box>
              )}
            </Box>

            <Box sx={{ position: 'relative' }}>
              <TextField
                label="Start Time"
                type="time"
                value={startTime}
                onChange={(e) => {
                  if (isGuest) {
                    setShowGuestDialog(true);
                    return;
                  }
                  setStartTime(e.target.value);
                  // Apply filters immediately when start time changes
                  setTimeout(() => {
                    applyFilters(selectedArtist, selectedStation, startDate, endDate, e.target.value, endTime);
                  }, 10);
                }}
                InputLabelProps={{
                  shrink: true,
                  sx: { color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff' }
                }}
                sx={{
                  width: '100%',
                  backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  borderRadius: 1,
                  '& .MuiOutlinedInput-root': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                    '& fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#555',
                      borderWidth: '1px',
                    },
                    '&:hover fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                    '&::-webkit-calendar-picker-indicator': {
                      filter: (theme) => theme.palette.mode === 'light' ? 'invert(0)' : 'invert(1)',
                      cursor: 'pointer',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    fontWeight: 'bold',
                  },
                }}
              />
              {startTime && (
                <Box
                  onClick={() => {
                    if (isGuest) {
                      setShowGuestDialog(true);
                      return;
                    }
                    setStartTime('');
                    setTimeout(() => {
                      applyFilters(selectedArtist, selectedStation, startDate, endDate, '', endTime);
                    }, 10);
                  }}
                  sx={{
                    position: 'absolute',
                    right: 40,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer',
                    color: '#ff6b6b',
                    fontSize: '18px',
                    '&:hover': {
                      color: '#ff8a8a',
                      transform: 'translateY(-50%) scale(1.1)',
                    },
                    transition: 'all 0.2s ease',
                    zIndex: 10,
                  }}
                >
                  ✕
                </Box>
              )}
            </Box>

            <Box sx={{ position: 'relative' }}>
              <TextField
                label="End Time"
                type="time"
                value={endTime}
                onChange={(e) => {
                  if (isGuest) {
                    setShowGuestDialog(true);
                    return;
                  }
                  setEndTime(e.target.value);
                  // Apply filters immediately when end time changes
                  setTimeout(() => {
                    applyFilters(selectedArtist, selectedStation, startDate, endDate, startTime, e.target.value);
                  }, 10);
                }}
                InputLabelProps={{
                  shrink: true,
                  sx: { color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff' }
                }}
                sx={{
                  width: '100%',
                  backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                  borderRadius: 1,
                  '& .MuiOutlinedInput-root': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                    '& fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#555',
                      borderWidth: '1px',
                    },
                    '&:hover fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                    '& fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#555',
                      borderWidth: '1px',
                    },
                    '&:hover fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                    '& fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#555',
                      borderWidth: '1px',
                    },
                    '&:hover fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: (theme) => theme.palette.mode === 'light' ? '#000' : '#1DB954',
                      borderWidth: '1px',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                    '&::-webkit-calendar-picker-indicator': {
                      filter: (theme) => theme.palette.mode === 'light' ? 'invert(0)' : 'invert(1)',
                      cursor: 'pointer',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
                    fontWeight: 'bold',
                  },
                }}
              />
              {endTime && (
                <Box
                  onClick={() => {
                    if (isGuest) {
                      setShowGuestDialog(true);
                      return;
                    }
                    setEndTime('');
                    setTimeout(() => {
                      applyFilters(selectedArtist, selectedStation, startDate, endDate, startTime, '');
                    }, 10);
                  }}
                  sx={{
                    position: 'absolute',
                    right: 40,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer',
                    color: '#ff6b6b',
                    fontSize: '18px',
                    '&:hover': {
                      color: '#ff8a8a',
                      transform: 'translateY(-50%) scale(1.1)',
                    },
                    transition: 'all 0.2s ease',
                    zIndex: 10,
                  }}
                >
                  ✕
                </Box>
              )}
            </Box>
            
            {/* Clear All Filters Button */}
            <Button
              onClick={clearAllFilters}
              variant="outlined"
              sx={{
                mt: 2,
                color: '#ff6b6b',
                borderColor: '#ff6b6b',
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                fontWeight: 'bold',
                textTransform: 'none',
                '&:hover': {
                  backgroundColor: 'rgba(255, 107, 107, 0.2)',
                  borderColor: '#ff8a8a',
                  color: '#ff8a8a',
                },
                '&:active': {
                  backgroundColor: 'rgba(255, 107, 107, 0.3)',
                },
              }}
            >
              🗑️ Clear All Filters
            </Button>
          </Box>
        </Paper>

        {/* Main panel: Songs + search */}
        <Container
          sx={{
            flexGrow: 1,
            maxWidth: { xs: '95%', sm: '85%', md: '85%', lg: '80%' },
            borderRadius: '10px',
            border: (theme) => theme.palette.mode === 'light' ? '1px solid #e5e7eb' : '2px solid rgba(255, 255, 255, 0.2)',
            background: (theme) => theme.palette.mode === 'light' 
              ? 'linear-gradient(180deg, #f7f7f7 0%, #E9E9E9 100%)' 
              : 'rgba(255, 255, 255, 0.1)',
            p: { xs: 1.5, md: 2.5 },
            height: { xs: 'auto', md: '85vh' },
            maxHeight: { xs: '90vh', md: '85vh' },
            minHeight: { xs: '40vh', md: '85vh' }, // Now matches filters container height
            display: 'flex',
            flexDirection: 'column',
            mx: { xs: 'auto', md: 0 },
            mt: { xs: 1, md: 0 },
          }}
        >
          {/* Search bar */}
          <Box sx={{ 
            mb: { xs: 2, md: 2.5 }, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            px: { xs: 1, md: 2 },
            gap: { xs: 1.5, md: 2 },
          }}>
            <TextField
              variant="outlined"
              placeholder={isGuest ? "Search songs, albums, artists, radios... (Click to try)" : "Search songs, albums, artists, radios..."}
              value={searchQuery}
              onChange={(e) => {
                if (isGuest) {
                  setShowGuestDialog(true);
                  return;
                }
                setSearchQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (isGuest && e.key === 'Enter') {
                  e.preventDefault();
                  setShowGuestDialog(true);
                }
              }}
              sx={{
                backgroundColor: '#fff',
                borderRadius: '50px',
                width: '70%',
                maxWidth: '600px',
                '& .MuiOutlinedInput-root': {
                  borderRadius: '50px',
                  '& fieldset': {
                    borderRadius: '50px',
                    borderColor: 'transparent',
                  },
                  '&:hover fieldset': {
                    borderColor: '#1DB954',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#1DB954',
                  },
                },
                '& .MuiInputBase-input': {
                  padding: '12px 20px',
                  '&::placeholder': {
                    color: '#999',
                    opacity: 1,
                  },
                },
              }}
            />
            
            {/* Songs Count - Level with Search Bar */}
            <Box
              sx={{
                backgroundColor: 'rgba(29, 185, 84, 0.9)',
                color: '#fff',
                borderRadius: '28px',
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: 'bold',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                whiteSpace: 'nowrap',
                minWidth: 'fit-content',
              }}
            >
              {filteredSongs.length} song{filteredSongs.length !== 1 ? 's' : ''}
            </Box>
          </Box>

          {/* Scrollable songs area */}
          <Box sx={{ 
            flexGrow: 1, 
            overflowY: 'auto', 
            px: { xs: 0.5, md: 1 },
            maxHeight: { 
              xs: '850px', // Increased from 780px to 850px for mobile (allows ~3.5 cards)
              sm: '600px', // Increased from 520px to 600px for small screens
              md: '700px'  // Increased from 600px to 700px for desktop (allows ~3 rows of cards)
            }
          }}>
            <Grid container spacing={{ xs: 1.5, sm: 2, md: 2.5 }}>
              {filteredSongs.length === 0 ? (
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ textAlign: 'center', mt: 4, color: (theme) => theme.palette.mode === 'light' ? '#111827' : '#ffffff' }}>
                    No songs found with the current filters.
                  </Typography>
                </Grid>
              ) : (
                filteredSongs.map((song, index) => (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <Card elevation={0}
                      sx={(theme) => ({
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        backgroundColor: '#ffffff',
                        color: '#000000',
                        border: (theme) => theme.palette.mode === 'light' ? '1px solid rgba(0,0,0,0.23)' : '1px solid rgba(255,255,255,0.12)',
                        boxShadow: 'none',
                        '& .MuiTypography-body2': {
                          color: '#111827',
                        },
                      })}
                    >
                      <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                        <Typography variant="h6" gutterBottom>{song.title}</Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>Album: {song.album}</Typography>
                        {song.start_time && (
                          <Typography variant="body2" color="text.secondary" gutterBottom>Start: {new Date(song.start_time).toLocaleString()}</Typography>
                        )}
                        {song.end_time && (
                          <Typography variant="body2" color="text.secondary" gutterBottom>End: {new Date(song.end_time).toLocaleString()}</Typography>
                        )}
                        {song.duration && (
                          <Typography variant="body2" color="text.secondary" gutterBottom>Duration: {song.duration}</Typography>
                        )}
                        <Typography variant="body2" color="text.secondary" gutterBottom>Artist: {song.artist}</Typography>
                        {song.radio_name && (
                          <>
                            <Typography variant="body2" color="text.secondary" gutterBottom>Radio: {song.radio_name}</Typography>
                            <img
                              src={getRadioImage(song.radio_name)}
                              alt={song.radio_name}
                              style={{ width: '80px', height: 'auto', margin: 'auto' }}
                            />
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))
              )}
            </Grid>
          </Box>
        </Container>

      </Box>

      {/* Modern Floating Action Buttons */}
      
      {/* Print Report Button - Bottom positioned with glass-morphism */}
      <Box
        onClick={handlePrint}
        sx={{
          position: 'fixed',
          bottom: '86px',
          right: { xs: 16, sm: 32 },
          backgroundColor: 'rgba(255, 23, 68, 0.3)',
          backdropFilter: 'blur(10px)',
          color: '#fff',
          minWidth: { xs: 160, sm: 160 },
          width: { xs: 160, sm: 160 },
          height: { xs: 56, sm: 56 },
          borderRadius: '28px',
          fontSize: { xs: '14px', sm: '14px' },
          fontWeight: '500',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          opacity: 0.6,
          '&:hover': { 
            backgroundColor: 'rgba(255, 23, 68, 0.95)',
            opacity: 1,
            transform: 'translateY(-2px) scale(1.02)',
          },
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          textTransform: 'none',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Box component="span">📄</Box>
        <Box component="span">
          {isGuest ? 'Print Report (Try!)' : 'Print Report'}
        </Box>
      </Box>

      {/* Analyze Button - Bottom positioned with glass-morphism */}
      <Box
        onClick={handleAnalyze}
        sx={{
          position: 'fixed',
          bottom: '152px',
          right: { xs: 16, sm: 32 },
          backgroundColor: 'rgba(29, 185, 84, 0.3)',
          backdropFilter: 'blur(10px)',
          color: '#fff',
          minWidth: { xs: 160, sm: 160 },
          width: { xs: 160, sm: 160 },
          height: { xs: 56, sm: 56 },
          borderRadius: '28px',
          fontSize: { xs: '14px', sm: '14px' },
          fontWeight: '500',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          opacity: 0.6,
          '&:hover': { 
            backgroundColor: 'rgba(29, 185, 84, 0.95)',
            opacity: 1,
            transform: 'translateY(-2px) scale(1.02)',
          },
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          textTransform: 'none',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Box component="span">📊</Box>
        <Box component="span">
          {isGuest ? 'Analyze (Try!)' : 'Analyze'}
        </Box>
      </Box>

      {/* Back to Top Button - Consistent with AnalysisPage */}
      <Fab
        onClick={scrollToTop}
        sx={{
          position: 'fixed',
          bottom: '20px',
          right: { xs: 16, sm: 32 },
          backgroundColor: 'rgba(33, 150, 243, 0.3)',
          backdropFilter: 'blur(10px)',
          color: '#fff',
          minWidth: { xs: 160, sm: 160 },
          width: { xs: 160, sm: 160 },
          height: { xs: 56, sm: 56 },
          borderRadius: '28px',
          fontSize: { xs: '14px', sm: '14px' },
          fontWeight: '500',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          opacity: showBackToTop ? 0.6 : 0,
          visibility: showBackToTop ? 'visible' : 'hidden',
          transform: showBackToTop ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.8)',
          textTransform: 'none',
          '&:hover': { 
            backgroundColor: 'rgba(33, 150, 243, 0.95)',
            opacity: 1,
            transform: showBackToTop ? 'translateY(-2px) scale(1.02)' : 'translateY(10px) scale(0.8)',
          },
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          padding: 0,
        }}
      >
        <Box component="span">↑</Box>
        <Box component="span">Back to Top</Box>
      </Fab>

      {/* Guest Access Dialog */}
      <Dialog
        open={showGuestDialog}
        onClose={() => setShowGuestDialog(false)}
        PaperProps={{
          sx: {
            backgroundColor: '#1a1a1a',
            color: '#fff',
            borderRadius: 2,
          }
        }}
      >
        <DialogTitle sx={{ color: '#fff', textAlign: 'center' }}>
          🔒 Login Required
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#fff', textAlign: 'center', mb: 2 }}>
            This feature is only available for registered users.
          </Typography>
          <Typography sx={{ color: '#ccc', textAlign: 'center', fontSize: '0.9rem' }}>
            Please create an account or sign in to access search, filtering, report generation, and analytics features.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 1.5, pb: 2 }}>
          <Button
            onClick={() => setShowGuestDialog(false)}
            sx={{
              backgroundColor: '#1DB954',
              color: '#fff',
              '&:hover': { backgroundColor: '#1ed760' },
              textTransform: 'none',
            }}
          >
            Got it
          </Button>
          <Typography sx={{ color: '#ccc', fontSize: '0.9rem' }}>
            <Link
              component="button"
              underline="hover"
              sx={{ color: '#90caf9' }}
              onClick={() => {
                setShowGuestDialog(false);
                navigate('/authentication?popup=1&mode=signin');
              }}
            >
              Login or Sign up
            </Link>
          </Typography>
        </DialogActions>
      </Dialog>
      <Footer />
    </>
  );
};

export default HeaderOnlyPage;
