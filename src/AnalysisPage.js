import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Container, Grid, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Select, MenuItem, FormControl, InputLabel, TextField, Fab,
  Drawer, IconButton, useMediaQuery, useTheme, Avatar, CircularProgress
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { AccountCircle, Person, Email, Lock, Visibility, VisibilityOff } from '@mui/icons-material';
import axios from 'axios';
import { API_ENDPOINTS } from './config';
import Header from './header';
import { useNavigate } from 'react-router-dom';
import Footer from './Footer';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { register, login } from './Services/auth-service';
// Removed unused jwtDecode import
import Logo from './images/Logo.png';

const COLORS = ['#1DB954', '#ff1744', '#ff9800', '#2196F3', '#9C27B0', '#00BCD4'];

const AnalysisPage = ({ setMode, mode }) => {
  const [songs, setSongs] = useState([]);
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  // const [isMobile, setIsMobile] = useState(false); // Commented out unused variable
  const [analysisData, setAnalysisData] = useState({
    artistPlays: [],
    radioStationPlays: [],
    timeDistribution: [],
    songDistribution: [],
    trendingSongs: [],
    topArtists: [],
    monthlyTrends: [],
    stationDetails: {}
  });
  const [originalAnalysisData, setOriginalAnalysisData] = useState({
    artistPlays: [],
    radioStationPlays: [],
    timeDistribution: [],
    songDistribution: [],
    trendingSongs: [],
    topArtists: [],
    monthlyTrends: [],
    stationDetails: {}
  });
  const [selectedStation, setSelectedStation] = useState('All Stations');
  const [selectedTimeRange, setSelectedTimeRange] = useState('All Time');
  const [selectedArtist, setSelectedArtist] = useState('All Artists');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('All Months');
  const [selectedYear, setSelectedYear] = useState('All Years');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [filteredSongs, setFilteredSongs] = useState([]);
  const [availableArtists, setAvailableArtists] = useState(['All Artists']);
  const [availableStations, setAvailableStations] = useState(['All Stations']);
  
  // Responsive design states
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  
  // Authentication states
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [showSignIn, setShowSignIn] = useState(true);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);

  
  const navigate = useNavigate();

  const fetchSongs = useCallback(async () => {
    try {
      const token = localStorage.getItem("user");
      if (!token) {
        console.log("No token found, redirecting to authentication");
        navigate("/authentication");
        return;
      }

      const userData = JSON.parse(token);
      console.log("User data:", { hasAccess: !!userData.access, access: userData.access ? 'exists' : 'missing' });
      
      const config = {
        headers: {
          'Authorization': `Bearer ${userData.access}`,
          'Content-Type': 'application/json',
        }
      };

      const response = await axios.get(API_ENDPOINTS.SONGS, config);
      const allData = response.data;
      console.log("Successfully fetched songs:", allData.length);
      setSongs(allData);
      setFilteredSongs(allData);
      
      // Initialize available artists
      const uniqueArtists = [...new Set(allData.map(song => song.artist).filter(Boolean))];
      setAvailableArtists(['All Artists', ...uniqueArtists.sort()]);
      
      // Initialize available stations
      const uniqueStations = [...new Set(allData.map(song => song.station).filter(Boolean))];
      setAvailableStations(['All Stations', ...uniqueStations.sort()]);
      
      // Don't call processAnalysisData here - let useEffect handle it
    } catch (error) {
      console.error("Error fetching songs:", error);
      if (error.response?.status === 401) {
        // Token expired or invalid
        console.log("Token expired, removing from localStorage");
        localStorage.removeItem("user");
        localStorage.removeItem("guestMode");
        navigate("/authentication");
      }
    }
  }, [navigate]); // Removed processAnalysisData from dependencies

  useEffect(() => {
    const token = localStorage.getItem("user");
    const guestMode = localStorage.getItem("guestMode");
    
    console.log("AnalysisPage useEffect - token:", !!token, "guestMode:", guestMode);
    
    // Handle responsive check - commented out as isMobile is not used
    // const handleResize = () => {
    //   setIsMobile(window.innerWidth < 600);
    // };

    // Handle scroll for back to top button
    const handleScroll = () => {
      setShowBackToTop(window.pageYOffset > 300);
    };
    
    // Removed handleResize as isMobile is not used
    window.addEventListener('scroll', handleScroll);
    
    // First check if user is properly authenticated
    if (token) {
      try {
        const userData = JSON.parse(token);
        console.log("Parsed user data:", { hasAccess: !!userData.access });
        // Check if user has valid access token
        if (userData.access) {
          // User is properly authenticated, fetch songs
          console.log("User authenticated, fetching songs");
          setIsGuest(false);
          fetchSongs();
          return () => {
            window.removeEventListener('scroll', handleScroll);
          };
        } else {
          // No access token, redirect to login
          console.log("No access token, redirecting to authentication");
          localStorage.removeItem("user");
          localStorage.removeItem("guestMode");
          navigate("/authentication");
          return () => {
            window.removeEventListener('scroll', handleScroll);
          };
        }
      } catch (error) {
        console.error("Error parsing user data:", error);
        localStorage.removeItem("user");
        localStorage.removeItem("guestMode");
        navigate("/authentication");
        return () => {
          window.removeEventListener('scroll', handleScroll);
        };
      }
    } else if (guestMode === "true") {
      // No token but guest mode is active, show guest dialog
      console.log("Guest mode active, showing dialog");
      setIsGuest(true);
      setShowGuestDialog(true);
      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    } else {
      // No token and no guest mode, redirect to authentication
      console.log("No token, no guest mode, redirecting to authentication");
      navigate("/authentication");
      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, [navigate, fetchSongs]);

  // Initial data processing when songs are first loaded
  useEffect(() => {
    if (songs.length > 0 && analysisData.artistPlays.length === 0) {
      // Only process initial data if we haven't processed yet
      processAnalysisData(songs);
    }
  }, [songs, analysisData.artistPlays.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-trigger filtering when filter values change
  useEffect(() => {
    if (songs.length > 0) {
      const filteredData = applyFilters(selectedArtist, selectedStation, startDate, endDate, startTime, endTime);
      processAnalysisData(filteredData);
      setFilteredSongs(filteredData);
    }
  }, [selectedArtist, selectedStation, startDate, endDate, startTime, endTime, selectedMonth, selectedYear, selectedTimeRange, songs]); // eslint-disable-line react-hooks/exhaustive-deps

  const processAnalysisData = useCallback((data) => {
    // Handle empty data
    if (!data || data.length === 0) {
      setAnalysisData({
        artistPlays: [],
        radioStationPlays: [],
        timeDistribution: [],
        songDistribution: [],
        trendingSongs: [],
        topArtists: [],
        monthlyTrends: [],
        stationDetails: {}
      });
      return;
    }

    // Artist plays analysis
    const artistCounts = {};
    const radioCounts = {};
    const songCounts = {};
    const timeSlots = {};
    const monthlyData = {};
    const stationDetails = {};

    data.forEach(song => {
      // Skip if song data is incomplete
      if (!song || !song.artist || !song.title || !song.timestamp) {
        return;
      }

      // Artist analysis
      artistCounts[song.artist] = (artistCounts[song.artist] || 0) + 1;
      
      // Radio station analysis
      if (song.radio_name) {
        radioCounts[song.radio_name] = (radioCounts[song.radio_name] || 0) + 1;
        
        // Station-specific details
        if (!stationDetails[song.radio_name]) {
          stationDetails[song.radio_name] = {
            artists: {},
            songs: {},
            totalPlays: 0
          };
        }
        
        stationDetails[song.radio_name].totalPlays++;
        stationDetails[song.radio_name].artists[song.artist] = 
          (stationDetails[song.radio_name].artists[song.artist] || 0) + 1;
        stationDetails[song.radio_name].songs[song.title] = 
          (stationDetails[song.radio_name].songs[song.title] || 0) + 1;
      }
      
      // Song analysis
      songCounts[song.title] = (songCounts[song.title] || 0) + 1;
      
      // Time analysis
      try {
        const date = new Date(song.timestamp);
        if (!isNaN(date.getTime())) {
          const hour = date.getHours();
          const timeSlot = `${hour}:00`;
          timeSlots[timeSlot] = (timeSlots[timeSlot] || 0) + 1;
          
          // Monthly trends
          const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthlyData[monthYear] = (monthlyData[monthYear] || 0) + 1;
        }
      } catch (error) {
        console.warn("Invalid timestamp:", song.timestamp);
      }
    });

    // Convert to chart data
    const artistPlays = Object.entries(artistCounts)
      .map(([artist, count]) => ({ name: artist, plays: count }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 10);

    const radioStationPlays = Object.entries(radioCounts)
      .map(([radio, count]) => ({ name: radio, plays: count }))
      .sort((a, b) => b.plays - a.plays);

    const songDistribution = Object.entries(songCounts)
      .map(([song, count]) => ({ name: song, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const timeDistribution = Object.entries(timeSlots)
      .map(([time, count]) => ({ time, count }))
      .sort((a, b) => parseInt(a.time) - parseInt(b.time));

    const monthlyTrends = Object.entries(monthlyData)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Calculate trending songs for current month
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const currentYear = new Date().getFullYear();
    const currentMonthKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
    
    const currentMonthSongs = {};
    data.forEach(song => {
      if (!song || !song.title || !song.timestamp) return;
      
      try {
        const songDate = new Date(song.timestamp);
        if (!isNaN(songDate.getTime())) {
          const month = songDate.getMonth() + 1;
          const year = songDate.getFullYear();
          const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
          
          if (monthKey === currentMonthKey) {
            currentMonthSongs[song.title] = (currentMonthSongs[song.title] || 0) + 1;
          }
        }
      } catch (error) {
        // Skip invalid timestamps
      }
    });

    const trendingSongs = Object.entries(currentMonthSongs)
      .map(([song, count]) => ({ name: song, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const processedData = {
      artistPlays,
      radioStationPlays,
      timeDistribution,
      songDistribution,
      trendingSongs,
      topArtists: artistPlays.slice(0, 5),
      monthlyTrends,
      stationDetails
    };

    setAnalysisData(processedData);
    
    // Store original data only if it's the first time processing (no filters applied)
    if (selectedStation === 'All Stations' && selectedTimeRange === 'All Time' && selectedArtist === 'All Artists' && 
        !startDate && !endDate && !startTime && !endTime && selectedMonth === 'All Months' && selectedYear === 'All Years') {
      setOriginalAnalysisData(processedData);
    }
  }, [selectedStation, selectedTimeRange, selectedArtist, startDate, endDate, startTime, endTime, selectedMonth, selectedYear]);

  // Helper function to get unique months from the data
  const getUniqueMonths = () => {
    const months = new Set();
    songs.forEach(song => {
      if (song.timestamp) {
        try {
          const date = new Date(song.timestamp);
          if (!isNaN(date.getTime())) {
            const month = date.getMonth() + 1; // getMonth() returns 0-11, so add 1
            months.add(month);
          }
        } catch (error) {
          // Skip invalid timestamps
        }
      }
    });
    return Array.from(months).sort((a, b) => a - b);
  };

  // Helper function to get unique years from the data
  const getUniqueYears = () => {
    const years = new Set();
    songs.forEach(song => {
      if (song.timestamp) {
        try {
          const date = new Date(song.timestamp);
          if (!isNaN(date.getTime())) {
            years.add(date.getFullYear());
          }
        } catch (error) {
          // Skip invalid timestamps
        }
      }
    });
    return Array.from(years).sort((a, b) => b - a); // Sort descending (newest first)
  };

  // Helper function to get month name
  const getMonthName = (monthNumber) => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[monthNumber - 1];
  };

  const handleBackToList = () => {
    navigate('/home');
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  };

  const handleBackToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const applyFilters = useCallback((artist, station, sDate, eDate, sTime, eTime) => {
    let filtered = songs;

    // Filter by artist
    if (artist !== 'All Artists') {
      filtered = filtered.filter(song => song.artist === artist);
    }

    // Filter by station
    if (station !== 'All Stations') {
      filtered = filtered.filter(song => song.radio_name === station);
    }

    // Filter by date - handle individual dates properly (prioritize custom dates over time range)
    if (sDate || eDate) {
      filtered = filtered.filter(song => {
        try {
          const songDate = new Date(song.timestamp);
          if (isNaN(songDate.getTime())) return false;
          
          // If both dates are provided, filter within range
          if (sDate && eDate) {
            const startDateTime = new Date(sDate);
            const endDateTime = new Date(eDate);
            // Set time to beginning and end of day for proper range filtering
            startDateTime.setHours(0, 0, 0, 0);
            endDateTime.setHours(23, 59, 59, 999);
            return songDate >= startDateTime && songDate <= endDateTime;
          }
          
          // If only start date is provided - filter from start date onwards (till now)
          if (sDate && !eDate) {
            const startDateTime = new Date(sDate);
            startDateTime.setHours(0, 0, 0, 0);
            const now = new Date();
            return songDate >= startDateTime && songDate <= now;
          }
          
          // If only end date is provided - filter up to end date (from beginning)
          if (!sDate && eDate) {
            const endDateTime = new Date(eDate);
            endDateTime.setHours(23, 59, 59, 999);
            return songDate <= endDateTime;
          }
          
          return true;
        } catch (error) {
          return false;
        }
      });
    } else if (selectedTimeRange !== 'All Time') {
      // Only apply preset time range if no custom dates are selected
      const now = new Date();
      const daysAgo = selectedTimeRange === 'Last 7 Days' ? 7 : 
                     selectedTimeRange === 'Last 30 Days' ? 30 : 0;
      
      if (daysAgo > 0) {
        const cutoffDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
        filtered = filtered.filter(song => {
          try {
            const songDate = new Date(song.timestamp);
            return !isNaN(songDate.getTime()) && songDate >= cutoffDate;
          } catch (error) {
            return false;
          }
        });
      }
    }

    // Filter by time range
    if (sTime || eTime) {
      filtered = filtered.filter(song => {
        try {
          const songDate = new Date(song.timestamp);
          if (isNaN(songDate.getTime())) return false;
          
          const songHour = songDate.getHours();
          const songMinute = songDate.getMinutes();
          const songTimeString = `${songHour.toString().padStart(2, '0')}:${songMinute.toString().padStart(2, '0')}`;
          
          if (sTime && eTime) {
            return songTimeString >= sTime && songTimeString <= eTime;
          }
          if (sTime && !eTime) {
            return songTimeString >= sTime;
          }
          if (!sTime && eTime) {
            return songTimeString <= eTime;
          }
          return true;
        } catch (error) {
          return false;
        }
      });
    }

    // Filter by month
    if (selectedMonth !== 'All Months') {
      filtered = filtered.filter(song => {
        try {
          const songDate = new Date(song.timestamp);
          if (!isNaN(songDate.getTime())) {
            return (songDate.getMonth() + 1) === parseInt(selectedMonth);
          }
          return false;
        } catch (error) {
          return false;
        }
      });
    }

    // Filter by year
    if (selectedYear !== 'All Years') {
      filtered = filtered.filter(song => {
        try {
          const songDate = new Date(song.timestamp);
          if (!isNaN(songDate.getTime())) {
            return songDate.getFullYear() === parseInt(selectedYear);
          }
          return false;
        } catch (error) {
          return false;
        }
      });
    }

    // Update filtered songs state
    setFilteredSongs(filtered);
    
    return filtered;
  }, [songs, selectedTimeRange, selectedMonth, selectedYear]);

  const getStationDetails = (stationName) => {
    if (!analysisData.stationDetails[stationName]) return null;
    
    const station = analysisData.stationDetails[stationName];
    const topArtists = Object.entries(station.artists)
      .map(([artist, count]) => ({ name: artist, plays: count }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5);
    
    const topSongs = Object.entries(station.songs)
      .map(([song, count]) => ({ name: song, plays: count }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5);
    
    return { topArtists, topSongs, totalPlays: station.totalPlays };
  };

  const getArtistDetails = (artistName) => {
    const artistSongs = songs.filter(song => song.artist === artistName);
    if (artistSongs.length === 0) return null;

    // Calculate song distribution for this artist
    const songCounts = {};
    artistSongs.forEach(song => {
      const songTitle = song.title || 'Unknown Song';
      songCounts[songTitle] = (songCounts[songTitle] || 0) + 1;
    });

    const topSongs = Object.entries(songCounts)
      .map(([name, plays]) => ({ name, plays }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 10);

    // Calculate station distribution for this artist
    const stationCounts = {};
    artistSongs.forEach(song => {
      const stationName = song.radio_name || 'Unknown Station';
      stationCounts[stationName] = (stationCounts[stationName] || 0) + 1;
    });

    const topStations = Object.entries(stationCounts)
      .map(([name, plays]) => ({ name, plays }))
      .sort((a, b) => b.plays - a.plays);

    // Calculate monthly trends for this artist
    const monthlyData = {};
    artistSongs.forEach(song => {
      try {
        const date = new Date(song.timestamp);
        if (!isNaN(date.getTime())) {
          const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthlyData[monthYear] = (monthlyData[monthYear] || 0) + 1;
        }
      } catch (error) {
        // Skip invalid timestamps
      }
    });

    const monthlyTrends = Object.entries(monthlyData)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      totalPlays: artistSongs.length,
      topSongs,
      topStations,
      monthlyTrends
    };
  };

  const handleStationChange = (value) => {
    setSelectedStation(value);
    
    if (value !== 'All Stations') {
      setTimeout(() => scrollToSection('station-details'), 100);
    } else {
      setTimeout(() => scrollToSection('charts-grid'), 100);
    }
  };

  const handleTimeRangeChange = (value) => {
    setSelectedTimeRange(value);
    // Clear custom dates when preset time range is selected
    if (value !== 'All Time' && (startDate || endDate)) {
      setStartDate('');
      setEndDate('');
    }
    
    setTimeout(() => scrollToSection('charts-grid'), 100);
  };

  const handleArtistChange = (value) => {
    setSelectedArtist(value);
    
    if (value !== 'All Artists') {
      setTimeout(() => scrollToSection('artist-details'), 100);
    } else {
      setTimeout(() => scrollToSection('charts-grid'), 100);
    }
  };

  const handleDateTimeChange = () => {
    // Reset time range when custom dates are selected to avoid conflicts
    if ((startDate || endDate) && selectedTimeRange !== 'All Time') {
      setSelectedTimeRange('All Time');
    }
    
    // Scroll to charts section (filtering will be handled by useEffect)
    setTimeout(() => scrollToSection('charts-grid'), 100);
  };

  const handleMonthChange = (value) => {
    setSelectedMonth(value);
    
    setTimeout(() => scrollToSection('charts-grid'), 100);
  };

  const handleYearChange = (value) => {
    setSelectedYear(value);
    
    setTimeout(() => scrollToSection('charts-grid'), 100);
  };

  const clearAllFilters = () => {
    setSelectedStation('All Stations');
    setSelectedTimeRange('All Time');
    setSelectedArtist('All Artists');
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
    setSelectedMonth('All Months');
    setSelectedYear('All Years');
    
    // Reset to original data
    setAnalysisData(originalAnalysisData);
    setFilteredSongs(songs);
    
    // Reset available artists to original full list
    const uniqueArtists = [...new Set(songs.map(song => song.artist).filter(Boolean))];
    setAvailableArtists(['All Artists', ...uniqueArtists.sort()]);
    
    // Reset available stations to original full list
    const uniqueStations = [...new Set(songs.map(song => song.station).filter(Boolean))];
    setAvailableStations(['All Stations', ...uniqueStations.sort()]);
    
    setTimeout(() => scrollToSection('charts-grid'), 100);
  };

  const handlePrintReport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let yPosition = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(29, 185, 84); // Green color
    doc.text('Music Analytics Report', pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 15;
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text('FairPlay Music Analytics Dashboard', pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 10;
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 20;

    // Filters Applied
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Applied Filters:', 20, yPosition);
    yPosition += 8;
    
    doc.setFontSize(10);
    doc.text(`• Radio Station: ${selectedStation}`, 25, yPosition);
    yPosition += 6;
    doc.text(`• Time Range: ${selectedTimeRange}`, 25, yPosition);
    yPosition += 6;
    doc.text(`• Artist: ${selectedArtist}`, 25, yPosition);
    yPosition += 6;
    
    if (startDate || endDate) {
      const dateRange = `${startDate || 'Not set'} to ${endDate || 'Not set'}`;
      doc.text(`• Custom Date Range: ${dateRange}`, 25, yPosition);
      yPosition += 6;
    }
    
    if (startTime || endTime) {
      const timeRange = `${startTime || 'Not set'} to ${endTime || 'Not set'}`;
      doc.text(`• Time Range: ${timeRange}`, 25, yPosition);
      yPosition += 6;
    }
    
    yPosition += 15;

    // Summary Statistics
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Summary Statistics:', 20, yPosition);
    yPosition += 10;

    const summaryData = [
      ['Total Songs Analyzed', songs.length.toString()],
      ['Unique Artists', analysisData.artistPlays.length.toString()],
      ['Radio Stations', analysisData.radioStationPlays.length.toString()],
      ['Time Period Covered', analysisData.monthlyTrends.length > 0 ? 
        `${analysisData.monthlyTrends[0]?.month || 'N/A'} - ${analysisData.monthlyTrends[analysisData.monthlyTrends.length - 1]?.month || 'N/A'}` : 'N/A']
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [29, 185, 84] },
      margin: { left: 20, right: 20 }
    });

    yPosition = doc.lastAutoTable.finalY + 20;

    // Top Artists
    if (analysisData.artistPlays.length > 0) {
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.text('Top Artists by Play Count:', 20, yPosition);
      yPosition += 10;

      const artistsData = analysisData.artistPlays.slice(0, 10).map(artist => [
        artist.name,
        artist.plays.toString()
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Artist', 'Play Count']],
        body: artistsData,
        theme: 'striped',
        headStyles: { fillColor: [29, 185, 84] },
        margin: { left: 20, right: 20 }
      });

      yPosition = doc.lastAutoTable.finalY + 20;
    }

    // Radio Station Distribution
    if (analysisData.radioStationPlays.length > 0) {
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.text('Radio Station Play Distribution:', 20, yPosition);
      yPosition += 10;

      const stationsData = analysisData.radioStationPlays.map(station => [
        station.name,
        station.plays.toString(),
        `${((station.plays / songs.length) * 100).toFixed(1)}%`
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Radio Station', 'Play Count', 'Percentage']],
        body: stationsData,
        theme: 'striped',
        headStyles: { fillColor: [255, 23, 68] },
        margin: { left: 20, right: 20 }
      });

      yPosition = doc.lastAutoTable.finalY + 20;
    }

    // Top Songs
    if (analysisData.songDistribution.length > 0) {
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.text('Top Songs by Play Count:', 20, yPosition);
      yPosition += 10;

      const songsData = analysisData.songDistribution.slice(0, 10).map(song => [
        song.name.length > 40 ? song.name.substring(0, 40) + '...' : song.name,
        song.count.toString()
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Song Title', 'Play Count']],
        body: songsData,
        theme: 'striped',
        headStyles: { fillColor: [33, 150, 243] },
        margin: { left: 20, right: 20 }
      });

      yPosition = doc.lastAutoTable.finalY + 20;
    }

    // Station-specific analysis if a station is selected
    if (selectedStation !== 'All Stations') {
      const stationData = getStationDetails(selectedStation);
      if (stationData) {
        if (yPosition > pageHeight - 100) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(16);
        doc.setTextColor(29, 185, 84);
        doc.text(`${selectedStation} - Detailed Analysis`, 20, yPosition);
        yPosition += 15;

        // Station summary
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Total Plays: ${stationData.totalPlays}`, 20, yPosition);
        yPosition += 8;
        doc.text(`Unique Artists: ${stationData.topArtists.length}`, 20, yPosition);
        yPosition += 8;
        doc.text(`Unique Songs: ${stationData.topSongs.length}`, 20, yPosition);
        yPosition += 15;

        // Station top artists
        if (stationData.topArtists.length > 0) {
          doc.setFontSize(14);
          doc.text(`Top Artists on ${selectedStation}:`, 20, yPosition);
          yPosition += 10;

          const stationArtistsData = stationData.topArtists.map(artist => [
            artist.name,
            artist.plays.toString()
          ]);

          autoTable(doc, {
            startY: yPosition,
            head: [['Artist', 'Play Count']],
            body: stationArtistsData,
            theme: 'striped',
            headStyles: { fillColor: [255, 152, 0] },
            margin: { left: 20, right: 20 }
          });

          yPosition = doc.lastAutoTable.finalY + 20;
        }
      }
    }

    // Artist-specific analysis if an artist is selected
    if (selectedArtist !== 'All Artists') {
      const artistData = getArtistDetails(selectedArtist);
      if (artistData) {
        if (yPosition > pageHeight - 100) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(16);
        doc.setTextColor(156, 39, 176); // Purple color
        doc.text(`${selectedArtist} - Detailed Analysis`, 20, yPosition);
        yPosition += 15;

        // Artist summary
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Total Plays: ${artistData.totalPlays}`, 20, yPosition);
        yPosition += 8;
        doc.text(`Unique Songs: ${artistData.topSongs.length}`, 20, yPosition);
        yPosition += 8;
        doc.text(`Radio Stations: ${artistData.topStations.length}`, 20, yPosition);
        yPosition += 15;

        // Artist top songs
        if (artistData.topSongs.length > 0) {
          doc.setFontSize(14);
          doc.text(`Top Songs by ${selectedArtist}:`, 20, yPosition);
          yPosition += 10;

          const artistSongsData = artistData.topSongs.slice(0, 10).map(song => [
            song.name.length > 40 ? song.name.substring(0, 40) + '...' : song.name,
            song.plays.toString()
          ]);

          autoTable(doc, {
            startY: yPosition,
            head: [['Song Title', 'Play Count']],
            body: artistSongsData,
            theme: 'striped',
            headStyles: { fillColor: [156, 39, 176] },
            margin: { left: 20, right: 20 }
          });

          yPosition = doc.lastAutoTable.finalY + 20;
        }

        // Artist station distribution
        if (artistData.topStations.length > 0) {
          if (yPosition > pageHeight - 60) {
            doc.addPage();
            yPosition = 20;
          }

          doc.setFontSize(14);
          doc.text(`Stations Playing ${selectedArtist}:`, 20, yPosition);
          yPosition += 10;

          const artistStationsData = artistData.topStations.map(station => [
            station.name,
            station.plays.toString(),
            `${((station.plays / artistData.totalPlays) * 100).toFixed(1)}%`
          ]);

          autoTable(doc, {
            startY: yPosition,
            head: [['Radio Station', 'Play Count', 'Percentage']],
            body: artistStationsData,
            theme: 'striped',
            headStyles: { fillColor: [0, 188, 212] },
            margin: { left: 20, right: 20 }
          });

          yPosition = doc.lastAutoTable.finalY + 20;
        }
      }
    }

    // Footer
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${totalPages} - Generated by FairPlay Music Analytics`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Save the PDF
    let fileName = 'FairPlay_Analytics_Report';
    if (selectedStation !== 'All Stations') {
      fileName += `_${selectedStation}`;
    }
    if (selectedArtist !== 'All Artists') {
      fileName += `_${selectedArtist.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
    fileName += `_${new Date().toISOString().split('T')[0]}.pdf`;
    
    doc.save(fileName);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    
    setIsGuest(false);
    // Don't navigate - just refresh the current page state
  };



  const handleAuthDialogClose = () => {
    setAuthDialogOpen(false);
    setError(null);
    setShowPassword(false);
    setShowSignUpPassword(false);
    setShowConfirmPassword(false);
  };

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
      if (response.success) {
        const userData = {
          access: response.access,
          refresh: response.refresh,
          username: response.username || username
        };
        localStorage.setItem("user", JSON.stringify(userData));
        setIsGuest(false);
        setAuthDialogOpen(false);
        // Refresh the page data
        window.location.reload();
      } else {
        setError(response.message || "Invalid credentials");
      }
    } catch (error) {
      setError("Login failed. Please try again.");
    }
  };

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSignUpLoading(true);
    
    const data = new FormData(e.currentTarget);
    const username = data.get('username');
    const email = data.get('email');
    const password = data.get('password');
    const confirmPassword = data.get('confirmPassword');

    if (!username || !email || !password || !confirmPassword) {
      setError("All fields are required");
      setSignUpLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setSignUpLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      setSignUpLoading(false);
      return;
    }

    try {
      const response = await register(username, email, password);
      if (response.success) {
        const userData = {
          access: response.access,
          refresh: response.refresh,
          username: response.username || username
        };
        localStorage.setItem("user", JSON.stringify(userData));
        setIsGuest(false);
        setAuthDialogOpen(false);
        setSignUpLoading(false);
        // Refresh the page data
        window.location.reload();
      } else {
        setError(response.message || "Registration failed");
        setSignUpLoading(false);
      }
    } catch (error) {
      setError("Registration failed. Please try again.");
      setSignUpLoading(false);
    }
  };

  const handleGuestAccess = () => {
    const guestData = { guest: true };
    localStorage.setItem("user", JSON.stringify(guestData));
    setIsGuest(true);
    setAuthDialogOpen(false);
    // Refresh the page
    window.location.reload();
  };

  return (
    <>
      <Header 
        onFilterMenuClick={() => setFilterDrawerOpen(!filterDrawerOpen)}
        isMobile={isMobile}
        setMode={setMode}
        mode={mode}
      />

      {/* Mobile Filter Drawer */}
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
              : '#1a1a1a',
            color: (theme) => theme.palette.mode === 'light' ? '#000000' : '#fff',
            top: '88px',
            height: 'calc(100vh - 88px)',
            borderTop: (theme) => theme.palette.mode === 'light' ? '1px solid #e5e7eb' : '1px solid rgba(255, 255, 255, 0.1)',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              Analytics Filters
            </Typography>
            <IconButton onClick={() => setFilterDrawerOpen(false)} sx={{ color: (theme) => theme.palette.mode === 'light' ? '#000000' : '#fff' }}>
              ✕
            </IconButton>
          </Box>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Mobile Radio Station Filter */}
            <FormControl fullWidth variant="outlined">
              <InputLabel id="mobile-station-label" sx={{ color: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.6)' : '#fff', fontWeight: 'bold' }}>Radio Station</InputLabel>
              <Select
                labelId="mobile-station-label"
                id="mobile-station-select"
                value={selectedStation}
                onChange={(e) => handleStationChange(e.target.value)}
                label="Radio Station"
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
                }}
              >
                <MenuItem value="All Stations">All Stations</MenuItem>
                {availableStations.filter(station => station !== 'All Stations').map((station, index) => (
                  <MenuItem key={index} value={station}>{station}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Mobile Artist Filter */}
            <FormControl fullWidth variant="outlined">
              <InputLabel id="mobile-artist-label" sx={{ color: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.6)' : '#fff', fontWeight: 'bold' }}>Artist</InputLabel>
              <Select
                labelId="mobile-artist-label"
                id="mobile-artist-select"
                value={selectedArtist}
                onChange={(e) => handleArtistChange(e.target.value)}
                label="Artist"
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
                }}
              >
                {availableArtists.map((artist, index) => (
                  <MenuItem key={index} value={artist}>{artist}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Mobile Time Range Filter */}
            <FormControl fullWidth variant="outlined">
              <InputLabel id="mobile-timerange-label" sx={{ color: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.6)' : '#fff', fontWeight: 'bold' }}>Time Range</InputLabel>
              <Select
                labelId="mobile-timerange-label"
                id="mobile-timerange-select"
                value={selectedTimeRange}
                onChange={(e) => handleTimeRangeChange(e.target.value)}
                label="Time Range"
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
                }}
              >
                <MenuItem value="All Time">All Time</MenuItem>
                <MenuItem value="Last 7 Days">Last 7 Days</MenuItem>
                <MenuItem value="Last 30 Days">Last 30 Days</MenuItem>
              </Select>
            </FormControl>

            {/* Mobile Start Date Filter */}
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => {
                const newStartDate = e.target.value;
                setStartDate(newStartDate);
                if (newStartDate && selectedTimeRange !== 'All Time') {
                  setSelectedTimeRange('All Time');
                }
                setTimeout(() => handleDateTimeChange(), 0);
              }}
              InputLabelProps={{
                shrink: true,
                sx: { color: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.6)' : '#fff', fontWeight: 'bold' }
              }}
              fullWidth
              sx={{
                backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                borderRadius: 1,
                '& .MuiOutlinedInput-root': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
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
                  '&::-webkit-calendar-picker-indicator': {
                    filter: (theme) => theme.palette.mode === 'light' ? 'none' : 'invert(1)',
                    cursor: 'pointer',
                  },
                  '&::-webkit-datetime-edit': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                  },
                  '&::-webkit-datetime-edit-text': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                  },
                },
              }}
            />

            {/* Mobile Start Time Filter */}
            <TextField
              label="Start Time"
              type="time"
              value={startTime}
              onChange={(e) => {
                const newStartTime = e.target.value;
                setStartTime(newStartTime);
                setTimeout(() => handleDateTimeChange(), 0);
              }}
              InputLabelProps={{
                shrink: true,
                sx: { color: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.6)' : '#fff', fontWeight: 'bold' }
              }}
              fullWidth
              sx={{
                backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                borderRadius: 1,
                '& .MuiOutlinedInput-root': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
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
                  '&::-webkit-datetime-edit': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                  },
                  '&::-webkit-datetime-edit-text': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                  },
                },
              }}
            />

            {/* Mobile End Date Filter */}
            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => {
                const newEndDate = e.target.value;
                setEndDate(newEndDate);
                if (newEndDate && selectedTimeRange !== 'All Time') {
                  setSelectedTimeRange('All Time');
                }
                setTimeout(() => handleDateTimeChange(), 0);
              }}
              InputLabelProps={{
                shrink: true,
                sx: { color: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.6)' : '#fff', fontWeight: 'bold' }
              }}
              fullWidth
              sx={{
                backgroundColor: '#2a2a2a',
                borderRadius: 1,
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  backgroundColor: '#2a2a2a',
                  '& fieldset': { borderColor: '#555', borderWidth: '2px' },
                  '&:hover fieldset': { borderColor: '#1DB954', borderWidth: '2px' },
                  '&.Mui-focused fieldset': { borderColor: '#1DB954', borderWidth: '2px' },
                },
                '& .MuiInputBase-input': {
                  color: '#fff',
                  backgroundColor: '#2a2a2a',
                  '&::-webkit-calendar-picker-indicator': {
                    filter: 'invert(1)',
                    cursor: 'pointer',
                  },
                },
              }}
            />

            {/* Mobile End Time Filter */}
            <TextField
              label="End Time"
              type="time"
              value={endTime}
              onChange={(e) => {
                const newEndTime = e.target.value;
                setEndTime(newEndTime);
                setTimeout(() => handleDateTimeChange(), 0);
              }}
              InputLabelProps={{
                shrink: true,
                sx: { color: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.6)' : '#fff', fontWeight: 'bold' }
              }}
              fullWidth
              sx={{
                backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                borderRadius: 1,
                '& .MuiOutlinedInput-root': {
                  color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
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
                  '&::-webkit-datetime-edit': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                  },
                  '&::-webkit-datetime-edit-text': {
                    color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                  },
                },
              }}
            />

            {/* Mobile Month Filter */}
            <FormControl fullWidth variant="outlined">
              <InputLabel id="mobile-month-label" sx={{ color: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.6)' : '#fff', fontWeight: 'bold' }}>Month</InputLabel>
              <Select
                labelId="mobile-month-label"
                id="mobile-month-select"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                label="Month"
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
                }}
              >
                <MenuItem value="All Months">All Months</MenuItem>
                <MenuItem value="1">January</MenuItem>
                <MenuItem value="2">February</MenuItem>
                <MenuItem value="3">March</MenuItem>
                <MenuItem value="4">April</MenuItem>
                <MenuItem value="5">May</MenuItem>
                <MenuItem value="6">June</MenuItem>
                <MenuItem value="7">July</MenuItem>
                <MenuItem value="8">August</MenuItem>
                <MenuItem value="9">September</MenuItem>
                <MenuItem value="10">October</MenuItem>
                <MenuItem value="11">November</MenuItem>
                <MenuItem value="12">December</MenuItem>
              </Select>
            </FormControl>

            {/* Mobile Year Filter */}
            <FormControl fullWidth variant="outlined">
              <InputLabel id="mobile-year-label" sx={{ color: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.6)' : '#fff', fontWeight: 'bold' }}>Year</InputLabel>
              <Select
                labelId="mobile-year-label"
                id="mobile-year-select"
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                label="Year"
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
                }}
              >
                <MenuItem value="All Years">All Years</MenuItem>
                <MenuItem value="2024">2024</MenuItem>
                <MenuItem value="2023">2023</MenuItem>
                <MenuItem value="2022">2022</MenuItem>
                <MenuItem value="2021">2021</MenuItem>
                <MenuItem value="2020">2020</MenuItem>
              </Select>
            </FormControl>

            {/* Mobile Clear Filters Button */}
            <Button
              onClick={clearAllFilters}
              variant="outlined"
              fullWidth
              sx={{
                borderColor: '#ff6b6b',
                color: '#ff6b6b',
                mt: 2,
                '&:hover': {
                  borderColor: '#ff8a8a',
                  backgroundColor: 'rgba(255, 107, 107, 0.1)',
                },
              }}
            >
              Clear All Filters
            </Button>
            
            {/* Logout Button - Only show for authenticated users on mobile screens */}
            {!isGuest && (
              <Button
                fullWidth
                variant="outlined"
                onClick={handleLogout}
                sx={{
                  mt: 2,
                  display: { xs: 'flex', md: 'none' }, // Only show on mobile, hidden on desktop
                  color: '#fff',
                  borderColor: 'rgba(255, 23, 68, 0.6)',
                  backgroundColor: 'rgba(255, 23, 68, 0.1)',
                  fontWeight: 'bold',
                  textTransform: 'none',
                  px: 3,
                  py: 1,
                  '&:hover': {
                    backgroundColor: 'rgba(255, 23, 68, 0.3)',
                    borderColor: 'rgba(255, 23, 68, 0.8)',
                    color: '#fff',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 6px 20px rgba(255, 23, 68, 0.3)',
                  },
                  '&:active': {
                    backgroundColor: 'rgba(255, 23, 68, 0.4)',
                    transform: 'translateY(0)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                🚪 Logout
              </Button>
            )}
          </Box>
        </Box>
      </Drawer>

      <Box
        sx={{
          background: (theme) => theme.palette.mode === 'light'
            ? 'linear-gradient(180deg, #f7f7f7 0%, #ffffff 100%)'
            : 'linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0.9) 100%)',
          minHeight: '100vh',
          pt: '200px',
          pb: 2,
        }}
      >
                 <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
                     {/* Header */}
           <Box sx={{ mb: 4, textAlign: 'center' }}>
             <Typography variant="h3" sx={{ 
              color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff', 
               mb: 2,
               fontSize: { xs: '1.8rem', sm: '2.5rem', md: '3rem' }
             }}>
               Music Analytics Dashboard
             </Typography>
             <Typography variant="body1" sx={{ 
              color: (theme) => theme.palette.mode === 'light' ? '#666' : '#ccc', 
               mb: 3,
               fontSize: { xs: '0.9rem', sm: '1rem' },
               px: { xs: 2, sm: 0 }
             }}>
               Comprehensive analysis of music plays across Tunisian radio stations
             </Typography>
          </Box>

          {/* Desktop Filters */}
          <Box sx={{ 
            mb: 4, 
            display: { xs: 'none', md: 'flex' },
            gap: { xs: 1, sm: 2 }, 
            justifyContent: 'center', 
            flexWrap: 'wrap',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center'
          }}>
                         <FormControl variant="outlined" sx={{ 
               minWidth: { xs: '100%', sm: 200 },
               width: { xs: '100%', sm: 'auto' }
             }}>
               <InputLabel id="desktop-station-label" sx={{ color: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.6)' : '#fff', fontWeight: 'bold' }}>Radio Station</InputLabel>
               <Select
                 labelId="desktop-station-label"
                 id="desktop-station-select"
                 value={selectedStation}
                 onChange={(e) => handleStationChange(e.target.value)}
                 label="Radio Station"
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
                 }}
               >
                 <MenuItem value="All Stations">All Stations</MenuItem>
                 {(originalAnalysisData.radioStationPlays.length > 0 ? originalAnalysisData.radioStationPlays : analysisData.radioStationPlays).map((station) => (
                   <MenuItem key={station.name} value={station.name}>
                     {station.name}
                   </MenuItem>
                 ))}
               </Select>
             </FormControl>
             
             <FormControl variant="outlined" sx={{ 
               minWidth: { xs: '100%', sm: 200 },
               width: { xs: '100%', sm: 'auto' }
             }}>
               <InputLabel id="desktop-timerange-label" sx={{ color: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.6)' : '#fff', fontWeight: 'bold' }}>Time Range</InputLabel>
               <Select
                 labelId="desktop-timerange-label"
                 id="desktop-timerange-select"
                 value={selectedTimeRange}
                 onChange={(e) => handleTimeRangeChange(e.target.value)}
                 label="Time Range"
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
                 }}
               >
                 <MenuItem value="All Time">All Time</MenuItem>
                 <MenuItem value="Last 7 Days">Last 7 Days</MenuItem>
                 <MenuItem value="Last 30 Days">Last 30 Days</MenuItem>
               </Select>
             </FormControl>
             
             <FormControl variant="outlined" sx={{ 
               minWidth: { xs: '100%', sm: 200 },
               width: { xs: '100%', sm: 'auto' }
             }}>
               <InputLabel id="desktop-artist-label" sx={{ color: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.6)' : '#fff', fontWeight: 'bold' }}>Artist</InputLabel>
               <Select
                 labelId="desktop-artist-label"
                 id="desktop-artist-select"
                 value={selectedArtist}
                 onChange={(e) => handleArtistChange(e.target.value)}
                 label="Artist"
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
                 }}
               >
                 <MenuItem value="All Artists">All Artists</MenuItem>
                 {availableArtists.slice(1).map((artist) => (
                   <MenuItem key={artist} value={artist}>
                     {artist}
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
                   const newStartDate = e.target.value;
                   setStartDate(newStartDate);
                   // Reset time range when custom date is selected
                   if (newStartDate && selectedTimeRange !== 'All Time') {
                     setSelectedTimeRange('All Time');
                   }
                   // Use setTimeout to ensure state is updated before filtering
                   setTimeout(() => handleDateTimeChange(), 0);
                 }}
                 InputLabelProps={{
                   shrink: true,
                   sx: { color: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.6)' : '#fff', fontWeight: 'bold' }
                 }}
                 sx={{
                   minWidth: { xs: '100%', sm: 150 },
                   width: { xs: '100%', sm: 'auto' },
                   backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                   borderRadius: 1,
                   '& .MuiOutlinedInput-root': {
                     color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
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
                     '&::-webkit-calendar-picker-indicator': {
                       filter: (theme) => theme.palette.mode === 'light' ? 'none' : 'invert(1)',
                       cursor: 'pointer',
                     },
                     '&::-webkit-datetime-edit': {
                       color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                     },
                     '&::-webkit-datetime-edit-text': {
                       color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                     },
                   },
                 }}
               />
               {startDate && (
                 <Box
                   onClick={() => {
                     setStartDate('');
                     setTimeout(() => {
                       handleDateTimeChange();
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
                   const newStartTime = e.target.value;
                   setStartTime(newStartTime);
                   // Use setTimeout to ensure state is updated before filtering
                   setTimeout(() => handleDateTimeChange(), 0);
                 }}
                 InputLabelProps={{
                   shrink: true,
                   sx: { color: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.6)' : '#fff', fontWeight: 'bold' }
                 }}
                 sx={{
                   minWidth: { xs: '100%', sm: 120 },
                   width: { xs: '100%', sm: 'auto' },
                   backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                   borderRadius: 1,
                   '& .MuiOutlinedInput-root': {
                     color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
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
                     '&::-webkit-calendar-picker-indicator': {
                       filter: (theme) => theme.palette.mode === 'light' ? 'none' : 'invert(1)',
                       cursor: 'pointer',
                     },
                     '&::-webkit-datetime-edit': {
                       color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                     },
                     '&::-webkit-datetime-edit-text': {
                       color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                     },
                   },
                 }}
               />
               {startTime && (
                 <Box
                   onClick={() => {
                     setStartTime('');
                     setTimeout(() => {
                       handleDateTimeChange();
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
                   const newEndDate = e.target.value;
                   setEndDate(newEndDate);
                   // Reset time range when custom date is selected
                   if (newEndDate && selectedTimeRange !== 'All Time') {
                     setSelectedTimeRange('All Time');
                   }
                   // Use setTimeout to ensure state is updated before filtering
                   setTimeout(() => handleDateTimeChange(), 0);
                 }}
                 InputLabelProps={{
                   shrink: true,
                   sx: { color: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.6)' : '#fff', fontWeight: 'bold' }
                 }}
                 sx={{
                   minWidth: { xs: '100%', sm: 150 },
                   width: { xs: '100%', sm: 'auto' },
                   backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                   borderRadius: 1,
                   '& .MuiOutlinedInput-root': {
                     color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
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
                     '&::-webkit-calendar-picker-indicator': {
                       filter: (theme) => theme.palette.mode === 'light' ? 'none' : 'invert(1)',
                       cursor: 'pointer',
                     },
                     '&::-webkit-datetime-edit': {
                       color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                     },
                     '&::-webkit-datetime-edit-text': {
                       color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                     },
                   },
                 }}
               />
               {endDate && (
                 <Box
                   onClick={() => {
                     setEndDate('');
                     setTimeout(() => {
                       handleDateTimeChange();
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
                   const newEndTime = e.target.value;
                   setEndTime(newEndTime);
                   // Use setTimeout to ensure state is updated before filtering
                   setTimeout(() => handleDateTimeChange(), 0);
                 }}
                 InputLabelProps={{
                   shrink: true,
                   sx: { color: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.6)' : '#fff', fontWeight: 'bold' }
                 }}
                 sx={{
                   minWidth: { xs: '100%', sm: 120 },
                   width: { xs: '100%', sm: 'auto' },
                   backgroundColor: (theme) => theme.palette.mode === 'light' ? '#ffffff' : '#2a2a2a',
                   borderRadius: 1,
                   '& .MuiOutlinedInput-root': {
                     color: (theme) => theme.palette.mode === 'light' ? '#000' : '#fff',
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
                     '&::-webkit-calendar-picker-indicator': {
                       filter: (theme) => theme.palette.mode === 'light' ? 'none' : 'invert(1)',
                       cursor: 'pointer',
                     },
                     '&::-webkit-datetime-edit': {
                       color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                     },
                     '&::-webkit-datetime-edit-text': {
                       color: (theme) => theme.palette.mode === 'light' ? '#000 !important' : '#fff !important',
                     },
                   },
                 }}
               />
               {endTime && (
                 <Box
                   onClick={() => {
                     setEndTime('');
                     setTimeout(() => {
                       handleDateTimeChange();
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

             {/* Month Filter */}
             <FormControl sx={{ 
               minWidth: { xs: '100%', sm: 150 },
               width: { xs: '100%', sm: 'auto' }
             }}>
               <InputLabel sx={{ color: '#fff', fontWeight: 'bold' }}>Month</InputLabel>
               <Select
                 value={selectedMonth}
                 onChange={(e) => handleMonthChange(e.target.value)}
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
                 }}
               >
                 <MenuItem value="All Months">All Months</MenuItem>
                 {getUniqueMonths().map((monthNum) => (
                   <MenuItem key={monthNum} value={monthNum.toString()}>
                     {getMonthName(monthNum)}
                   </MenuItem>
                 ))}
               </Select>
             </FormControl>

             {/* Year Filter */}
             <FormControl sx={{ 
               minWidth: { xs: '100%', sm: 120 },
               width: { xs: '100%', sm: 'auto' }
             }}>
               <InputLabel sx={{ color: '#fff', fontWeight: 'bold' }}>Year</InputLabel>
               <Select
                 value={selectedYear}
                 onChange={(e) => handleYearChange(e.target.value)}
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
                 }}
               >
                 <MenuItem value="All Years">All Years</MenuItem>
                 {getUniqueYears().map((year) => (
                   <MenuItem key={year} value={year.toString()}>
                     {year}
                   </MenuItem>
                 ))}
               </Select>
             </FormControl>
          </Box>

          {/* Clear All Filters Button */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 2 }}>
            <Button
              onClick={clearAllFilters}
              variant="outlined"
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
          </Box>

          {/* Songs Count Indicator */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
            <Box
              sx={{
                backgroundColor: 'rgba(29, 185, 84, 0.9)',
                color: '#fff',
                borderRadius: '12px',
                padding: '8px 20px',
                fontSize: '14px',
                fontWeight: 'bold',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 12px rgba(29, 185, 84, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              📊 {filteredSongs.length} song{filteredSongs.length !== 1 ? 's' : ''} selected for analysis
            </Box>
          </Box>

                     {/* Charts Grid */}
           <Grid container spacing={{ xs: 2, md: 3 }} id="charts-grid">
             {/* Top Artists Chart */}
             <Grid item xs={12} md={6}>
               <Card sx={{ 
                background: (theme) => theme.palette.mode === 'light' 
                  ? 'linear-gradient(180deg, #f7f7f7 0%, #E9E9E9 100%)' 
                  : '#1a1a1a', 
                color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff', 
                 height: { xs: '380px', sm: '380px', md: '380px' },
                 minHeight: { xs: '380px', sm: '380px', md: '380px' }
               }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: theme.palette.mode === 'light' ? '#111' : '#fff' }}>
                    Top Artists by Play Count
                  </Typography>
                                   <ResponsiveContainer width="100%" height={280}>
                     <BarChart data={analysisData.artistPlays}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.mode === 'light' ? '#e5e7eb' : '#333'} />
                      <XAxis dataKey="name" stroke={theme.palette.mode === 'light' ? '#111' : '#fff'} />
                      <YAxis stroke={theme.palette.mode === 'light' ? '#111' : '#fff'} />
                       <Tooltip 
                        contentStyle={theme.palette.mode === 'light' 
                          ? { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111' }
                          : { backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
                       />
                       <Legend />
                       <Bar dataKey="plays" fill="#1DB954" />
                     </BarChart>
                   </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

                         {/* Radio Station Distribution */}
             <Grid item xs={12} md={6}>
               <Card sx={{ 
                background: (theme) => theme.palette.mode === 'light' 
                  ? 'linear-gradient(180deg, #f7f7f7 0%, #E9E9E9 100%)' 
                  : '#1a1a1a', 
                color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff', 
                 height: { xs: '300px', sm: '350px', md: '400px' },
                 minHeight: { xs: '300px', sm: '350px', md: '400px' }
               }}>
                 <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: theme.palette.mode === 'light' ? '#111' : '#fff' }}>
                     Radio Station Play Distribution
                   </Typography>
                   <Box sx={{ display: 'flex', flexDirection: 'column', height: 300 }}>
                     <ResponsiveContainer width="100%" height={200}>
                       <PieChart>
                         <Pie
                           data={analysisData.radioStationPlays}
                           cx="50%"
                           cy="50%"
                           outerRadius={70}
                           innerRadius={35}
                           fill="#8884d8"
                           dataKey="plays"
                         >
                           {analysisData.radioStationPlays.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                           ))}
                         </Pie>
                         <Tooltip 
                           contentStyle={theme.palette.mode === 'light' 
                             ? { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111' }
                             : { backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
                         />
                       </PieChart>
                     </ResponsiveContainer>
                     
                     {/* Custom Legend - Vertical List */}
                     <Box sx={{ 
                       display: 'flex',
                       flexDirection: 'column',
                       gap: 0.5,
                       mt: 1,
                       maxHeight: 90,
                       overflowY: 'auto',
                       '&::-webkit-scrollbar': {
                         width: '4px',
                       },
                       '&::-webkit-scrollbar-track': {
                         backgroundColor: '#333',
                         borderRadius: '2px',
                       },
                       '&::-webkit-scrollbar-thumb': {
                         backgroundColor: '#666',
                         borderRadius: '2px',
                         '&:hover': {
                           backgroundColor: '#888',
                         },
                       },
                     }}>
                       {analysisData.radioStationPlays.map((entry, index) => (
                         <Box 
                           key={entry.name}
                           sx={{ 
                             display: 'flex', 
                             alignItems: 'center', 
                             gap: 1,
                             px: 1,
                             py: 0.25,
                             '&:hover': {
                               backgroundColor: 'rgba(255, 255, 255, 0.05)',
                               borderRadius: '4px',
                             },
                           }}
                         >
                           <Box 
                             sx={{
                               width: 10,
                               height: 10,
                               borderRadius: '50%',
                               backgroundColor: COLORS[index % COLORS.length],
                               flexShrink: 0
                             }}
                           />
                           <Typography 
                             variant="caption" 
                             sx={{ 
                               color: theme.palette.mode === 'light' ? '#111' : '#fff',
                               fontSize: '11px',
                               flex: 1,
                             }}
                           >
                             {entry.name}
                           </Typography>
                           <Typography 
                             variant="caption" 
                             sx={{ 
                               color: theme.palette.mode === 'light' ? '#666' : '#ccc',
                               fontSize: '10px',
                               fontWeight: 'bold',
                             }}
                           >
                             {((entry.plays / analysisData.radioStationPlays.reduce((sum, item) => sum + item.plays, 0)) * 100).toFixed(0)}%
                           </Typography>
                         </Box>
                       ))}
                     </Box>
                   </Box>
                </CardContent>
              </Card>
            </Grid>

                         {/* Time Distribution */}
             <Grid item xs={12} md={6}>
               <Card sx={{ 
                background: (theme) => theme.palette.mode === 'light' 
                  ? 'linear-gradient(180deg, #f7f7f7 0%, #E9E9E9 100%)' 
                  : '#1a1a1a', 
                color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff', 
                 height: { xs: '380px', sm: '380px', md: '380px' },
                 minHeight: { xs: '380px', sm: '380px', md: '380px' }
               }}>
                 <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: theme.palette.mode === 'light' ? '#111' : '#fff' }}>
                     Play Time Distribution (24h)
                   </Typography>
                   <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={analysisData.timeDistribution}>
                     <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.mode === 'light' ? '#e5e7eb' : '#333'} />
                     <XAxis dataKey="time" stroke={theme.palette.mode === 'light' ? '#111' : '#fff'} />
                     <YAxis stroke={theme.palette.mode === 'light' ? '#111' : '#fff'} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a1a', 
                          border: '1px solid #333',
                          color: '#fff'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#ff1744" 
                        fill="#ff1744" 
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

                         {/* Monthly Trends */}
             <Grid item xs={12} md={6}>
               <Card sx={{ 
                background: (theme) => theme.palette.mode === 'light' 
                  ? 'linear-gradient(180deg, #f7f7f7 0%, #E9E9E9 100%)' 
                  : '#1a1a1a', 
                color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff', 
                 height: { xs: '380px', sm: '380px', md: '380px' },
                 minHeight: { xs: '380px', sm: '380px', md: '380px' }
               }}>
                 <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: theme.palette.mode === 'light' ? '#111' : '#fff' }}>
                     Monthly Play Trends
                   </Typography>
                   <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={analysisData.monthlyTrends}>
                     <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.mode === 'light' ? '#e5e7eb' : '#333'} />
                     <XAxis dataKey="month" stroke={theme.palette.mode === 'light' ? '#111' : '#fff'} />
                     <YAxis stroke={theme.palette.mode === 'light' ? '#111' : '#fff'} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a1a', 
                          border: '1px solid #333',
                          color: '#fff'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#ff9800" 
                        strokeWidth={3}
                        dot={{ fill: '#ff9800', strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

                         {/* Song Distribution */}
             <Grid item xs={12} md={6}>
               <Card sx={{ 
                background: (theme) => theme.palette.mode === 'light' 
                  ? 'linear-gradient(180deg, #f7f7f7 0%, #E9E9E9 100%)' 
                  : '#1a1a1a', 
                color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff', 
                height: { xs: '450px', sm: '450px', md: '500px' },
                minHeight: { xs: '450px', sm: '450px', md: '500px' }
               }}>
                 <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: theme.palette.mode === 'light' ? '#111' : '#fff' }}>
                     Top Songs by Play Count
                   </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={analysisData.songDistribution}>
                     <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.mode === 'light' ? '#e5e7eb' : '#333'} />
                     <XAxis dataKey="name" stroke={theme.palette.mode === 'light' ? '#111' : '#fff'} angle={-45} textAnchor="end" height={100} />
                     <YAxis stroke={theme.palette.mode === 'light' ? '#111' : '#fff'} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a1a', 
                          border: '1px solid #333',
                          color: '#fff'
                        }}
                      />
                      <Bar dataKey="count" fill="#2196F3" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Trending Songs This Month */}
            <Grid item xs={12} md={6}>
              <Card sx={{ 
                background: (theme) => theme.palette.mode === 'light' 
                  ? 'linear-gradient(180deg, #f7f7f7 0%, #E9E9E9 100%)' 
                  : '#1a1a1a', 
                color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff', 
                height: { xs: '450px', sm: '450px', md: '500px' },
                minHeight: { xs: '450px', sm: '450px', md: '500px' }
              }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: theme.palette.mode === 'light' ? '#111' : '#fff' }}>
                    Trending Songs This Month
                  </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                   <BarChart data={analysisData.trendingSongs}>
                     <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.mode === 'light' ? '#e5e7eb' : '#333'} />
                     <XAxis dataKey="name" stroke={theme.palette.mode === 'light' ? '#111' : '#fff'} angle={-45} textAnchor="end" height={100} />
                     <YAxis stroke={theme.palette.mode === 'light' ? '#111' : '#fff'} />
                     <Tooltip 
                       contentStyle={theme.palette.mode === 'light' 
                         ? { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111' }
                         : { backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
                     />
                     <Bar dataKey="count" fill="#FF6B35" />
                   </BarChart>
                 </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Station Details */}
            {selectedStation !== 'All Stations' && (
              <Grid container spacing={3} sx={{ mt: 2 }} id="station-details">
                                 <Grid item xs={12}>
                   <Typography variant="h4" sx={{ 
                     color: theme.palette.mode === 'light' ? '#111' : '#fff', 
                     mb: 3, 
                     textAlign: 'center',
                     fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }
                   }}>
                     {selectedStation} - Detailed Analysis
                   </Typography>
                 </Grid>
                
                                 {/* Station Top Artists */}
                 <Grid item xs={12} md={6}>
                   <Card sx={{ 
                     background: (theme) => theme.palette.mode === 'light' 
                       ? 'linear-gradient(180deg, #f7f7f7 0%, #E9E9E9 100%)' 
                       : '#1a1a1a', 
                     color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff', 
                     height: { xs: '300px', sm: '350px', md: '400px' },
                     minHeight: { xs: '300px', sm: '350px', md: '400px' }
                   }}>
                     <CardContent>
                       <Typography variant="h6" sx={{ mb: 2, color: theme.palette.mode === 'light' ? '#111' : '#fff' }}>
                         Top Artists on {selectedStation}
                       </Typography>
                       <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={getStationDetails(selectedStation)?.topArtists || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.mode === 'light' ? '#e5e7eb' : '#333'} />
                          <XAxis dataKey="name" stroke={theme.palette.mode === 'light' ? '#111' : '#fff'} />
                          <YAxis stroke={theme.palette.mode === 'light' ? '#111' : '#fff'} />
                          <Tooltip 
                            contentStyle={theme.palette.mode === 'light' 
                              ? { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111' }
                              : { backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
                          />
                          <Bar dataKey="plays" fill="#ff9800" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                                 {/* Station Top Songs */}
                 <Grid item xs={12} md={6}>
                   <Card sx={{ 
                     background: (theme) => theme.palette.mode === 'light' 
                       ? 'linear-gradient(180deg, #f7f7f7 0%, #E9E9E9 100%)' 
                       : '#1a1a1a', 
                     color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff', 
                     height: { xs: '300px', sm: '350px', md: '400px' },
                     minHeight: { xs: '300px', sm: '350px', md: '400px' }
                   }}>
                     <CardContent>
                       <Typography variant="h6" sx={{ mb: 2, color: theme.palette.mode === 'light' ? '#111' : '#fff' }}>
                         Top Songs on {selectedStation}
                       </Typography>
                       <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={getStationDetails(selectedStation)?.topSongs || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.mode === 'light' ? '#e5e7eb' : '#333'} />
                          <XAxis dataKey="name" stroke={theme.palette.mode === 'light' ? '#111' : '#fff'} angle={-45} textAnchor="end" height={100} />
                          <YAxis stroke={theme.palette.mode === 'light' ? '#111' : '#fff'} />
                          <Tooltip 
                            contentStyle={theme.palette.mode === 'light' 
                              ? { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111' }
                              : { backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
                          />
                          <Bar dataKey="plays" fill="#ff1744" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Station Stats */}
                <Grid item xs={12}>
                  <Card sx={{ 
                    background: (theme) => theme.palette.mode === 'light' 
                      ? 'linear-gradient(180deg, #f7f7f7 0%, #E9E9E9 100%)' 
                      : '#1a1a1a', 
                    color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff' 
                  }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, color: theme.palette.mode === 'light' ? '#111' : '#fff', textAlign: 'center' }}>
                        {selectedStation} Statistics
                      </Typography>
                                             <Grid container spacing={{ xs: 2, md: 3 }} sx={{ textAlign: 'center' }}>
                         <Grid item xs={12} sm={4}>
                           <Typography variant="h4" sx={{ 
                             color: '#1DB954', 
                             fontWeight: 'bold',
                             fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }
                           }}>
                             {getStationDetails(selectedStation)?.totalPlays || 0}
                           </Typography>
                           <Typography variant="body2" sx={{ color: theme.palette.mode === 'light' ? '#666' : '#ccc' }}>
                             Total Plays
                           </Typography>
                         </Grid>
                         <Grid item xs={12} sm={4}>
                           <Typography variant="h4" sx={{ 
                             color: '#ff9800', 
                             fontWeight: 'bold',
                             fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }
                           }}>
                             {getStationDetails(selectedStation)?.topArtists?.length || 0}
                           </Typography>
                           <Typography variant="body2" sx={{ color: theme.palette.mode === 'light' ? '#666' : '#ccc' }}>
                             Unique Artists
                           </Typography>
                         </Grid>
                         <Grid item xs={12} sm={4}>
                           <Typography variant="h4" sx={{ 
                             color: '#ff1744', 
                             fontWeight: 'bold',
                             fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }
                           }}>
                             {getStationDetails(selectedStation)?.topSongs?.length || 0}
                           </Typography>
                           <Typography variant="body2" sx={{ color: theme.palette.mode === 'light' ? '#666' : '#ccc' }}>
                             Unique Songs
                           </Typography>
                         </Grid>
                       </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}

            {/* Artist Details */}
            {selectedArtist !== 'All Artists' && (
              <Grid container spacing={3} sx={{ mt: 2 }} id="artist-details">
                <Grid item xs={12}>
                  <Typography variant="h4" sx={{ 
                    color: theme.palette.mode === 'light' ? '#111' : '#fff', 
                    mb: 3, 
                    textAlign: 'center',
                    fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }
                  }}>
                    {selectedArtist} - Detailed Analysis
                  </Typography>
                </Grid>
                
                {/* Artist Top Songs */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ 
                    background: (theme) => theme.palette.mode === 'light' 
                      ? 'linear-gradient(180deg, #f7f7f7 0%, #E9E9E9 100%)' 
                      : '#1a1a1a', 
                    color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff', 
                    height: { xs: '300px', sm: '350px', md: '400px' },
                    minHeight: { xs: '300px', sm: '350px', md: '400px' }
                  }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, color: theme.palette.mode === 'light' ? '#111' : '#fff' }}>
                        Top Songs by {selectedArtist}
                      </Typography>
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={getArtistDetails(selectedArtist)?.topSongs || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.mode === 'light' ? '#e5e7eb' : '#333'} />
                          <XAxis dataKey="name" stroke={theme.palette.mode === 'light' ? '#111' : '#fff'} angle={-45} textAnchor="end" height={100} />
                          <YAxis stroke={theme.palette.mode === 'light' ? '#111' : '#fff'} />
                          <Tooltip 
                            contentStyle={theme.palette.mode === 'light' 
                              ? { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111' }
                              : { backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
                          />
                          <Bar dataKey="plays" fill="#9C27B0" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Artist Radio Station Distribution */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ 
                    background: (theme) => theme.palette.mode === 'light' 
                      ? 'linear-gradient(180deg, #f7f7f7 0%, #E9E9E9 100%)' 
                      : '#1a1a1a', 
                    color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff', 
                    height: { xs: '300px', sm: '350px', md: '400px' },
                    minHeight: { xs: '300px', sm: '350px', md: '400px' }
                  }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, color: theme.palette.mode === 'light' ? '#111' : '#fff' }}>
                        Stations Playing {selectedArtist}
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={getArtistDetails(selectedArtist)?.topStations || []}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="plays"
                          >
                            {(getArtistDetails(selectedArtist)?.topStations || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={theme.palette.mode === 'light' 
                              ? { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111' }
                              : { backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Artist Monthly Trends */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ 
                    background: (theme) => theme.palette.mode === 'light' 
                      ? 'linear-gradient(180deg, #f7f7f7 0%, #E9E9E9 100%)' 
                      : '#1a1a1a', 
                    color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff', 
                    height: { xs: '300px', sm: '350px', md: '400px' },
                    minHeight: { xs: '300px', sm: '350px', md: '400px' }
                  }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, color: theme.palette.mode === 'light' ? '#111' : '#fff' }}>
                        {selectedArtist} - Monthly Trends
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={getArtistDetails(selectedArtist)?.monthlyTrends || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.mode === 'light' ? '#e5e7eb' : '#333'} />
                          <XAxis dataKey="month" stroke={theme.palette.mode === 'light' ? '#111' : '#fff'} />
                          <YAxis stroke={theme.palette.mode === 'light' ? '#111' : '#fff'} />
                          <Tooltip 
                            contentStyle={theme.palette.mode === 'light' 
                              ? { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111' }
                              : { backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="count" 
                            stroke="#00BCD4" 
                            strokeWidth={3}
                            dot={{ fill: '#00BCD4', strokeWidth: 2, r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Artist Stats */}
                <Grid item xs={12} md={6}>
                  <Card sx={{ 
                    background: (theme) => theme.palette.mode === 'light' 
                      ? 'linear-gradient(180deg, #f7f7f7 0%, #E9E9E9 100%)' 
                      : '#1a1a1a', 
                    color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff' 
                  }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, color: theme.palette.mode === 'light' ? '#111' : '#fff', textAlign: 'center' }}>
                        {selectedArtist} Statistics
                      </Typography>
                      <Grid container spacing={{ xs: 2, md: 3 }} sx={{ textAlign: 'center' }}>
                        <Grid item xs={12} sm={4}>
                          <Typography variant="h4" sx={{ 
                            color: '#9C27B0', 
                            fontWeight: 'bold',
                            fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }
                          }}>
                            {getArtistDetails(selectedArtist)?.totalPlays || 0}
                          </Typography>
                          <Typography variant="body2" sx={{ color: theme.palette.mode === 'light' ? '#666' : '#ccc' }}>
                            Total Plays
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Typography variant="h4" sx={{ 
                            color: '#00BCD4', 
                            fontWeight: 'bold',
                            fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }
                          }}>
                            {getArtistDetails(selectedArtist)?.topSongs?.length || 0}
                          </Typography>
                          <Typography variant="body2" sx={{ color: theme.palette.mode === 'light' ? '#666' : '#ccc' }}>
                            Unique Songs
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Typography variant="h4" sx={{ 
                            color: '#FF9800', 
                            fontWeight: 'bold',
                            fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }
                          }}>
                            {getArtistDetails(selectedArtist)?.topStations?.length || 0}
                          </Typography>
                          <Typography variant="body2" sx={{ color: theme.palette.mode === 'light' ? '#666' : '#ccc' }}>
                            Radio Stations
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Grid>
        </Container>
      </Box>

      {/* Guest Access Dialog */}
      <Dialog
        open={showGuestDialog}
        onClose={() => {
          setShowGuestDialog(false);
          navigate('/home');
        }}
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
            The Analytics Dashboard is only available for registered users.
          </Typography>
          <Typography sx={{ color: '#ccc', textAlign: 'center', fontSize: '0.9rem' }}>
            Please create an account or sign in to access detailed music analytics and insights.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2, gap: 2 }}>
          <Button
            onClick={() => {
              setShowGuestDialog(false);
              navigate('/auth');
            }}
            sx={{
              backgroundColor: '#1DB954',
              color: '#fff',
              '&:hover': { backgroundColor: '#1ed760' },
              textTransform: 'none',
            }}
          >
            Sign In / Register
          </Button>
          <Button
            onClick={() => {
              setShowGuestDialog(false);
              localStorage.setItem("user", JSON.stringify({ guest: true }));
              window.location.reload(); // Reload to apply guest mode
            }}
            sx={{
              backgroundColor: '#ff9800',
              color: '#fff',
              '&:hover': { backgroundColor: '#f57c00' },
              textTransform: 'none',
            }}
          >
            Continue as Guest
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Back to Top Button */}
      <Fab
        onClick={handleBackToTop}
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
            boxShadow: '0 12px 28px rgba(33, 150, 243, 0.4)',
          },
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 8px 24px rgba(33, 150, 243, 0.2), 0 4px 12px rgba(0, 0, 0, 0.15)',
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
      
      {/* Floating Print Button */}
      <Box
        onClick={handlePrintReport}
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
            boxShadow: '0 12px 28px rgba(255, 23, 68, 0.4)',
          },
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 8px 24px rgba(255, 23, 68, 0.2), 0 4px 12px rgba(0, 0, 0, 0.15)',
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
        <Box component="span">Print Report</Box>
      </Box>
      
      {/* Floating Back Button */}
      <Box
        onClick={handleBackToList}
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
            boxShadow: '0 12px 28px rgba(29, 185, 84, 0.4)',
          },
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 8px 24px rgba(29, 185, 84, 0.2), 0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          textTransform: 'none',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Box component="span">←</Box>
        <Box component="span">Back to Home</Box>
      </Box>

      {/* Authentication Dialog */}
      <Dialog
        open={authDialogOpen}
        onClose={handleAuthDialogClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, rgba(18,18,18,0.95) 0%, rgba(29,185,84,0.05) 100%)',
            backdropFilter: 'blur(15px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
          }
        }}
      >
        <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
          <Box sx={{
            display: 'flex',
            width: '200%',
            transform: showSignIn ? 'translateX(0%)' : 'translateX(-50%)',
            transition: 'transform 0.6s ease-in-out',
          }}>
            {/* Sign In Form */}
            <Box sx={{ width: '50%', p: 4 }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Avatar sx={{ 
                  bgcolor: '#1DB954', 
                  width: 56, 
                  height: 56, 
                  mx: 'auto', 
                  mb: 2,
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
                <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Sign in to your account
                </Typography>
              </Box>

              <Box component="form" onSubmit={handleSignInSubmit} sx={{ mt: 1 }}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="username"
                  label="Username"
                  name="username"
                  autoComplete="username"
                  autoFocus
                  variant="outlined"
                  InputProps={{
                    startAdornment: <Person sx={{ color: 'rgba(255,255,255,0.5)', mr: 1 }} />,
                    sx: {
                      color: '#fff',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1DB954' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1DB954' }
                    }
                  }}
                  InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete="current-password"
                  variant="outlined"
                  InputProps={{
                    startAdornment: <Lock sx={{ color: 'rgba(255,255,255,0.5)', mr: 1 }} />,
                    endAdornment: (
                      <IconButton onClick={() => setShowPassword(!showPassword)} sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    ),
                    sx: {
                      color: '#fff',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1DB954' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1DB954' }
                    }
                  }}
                  InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
                />

                {error && (
                  <Typography color="error" variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
                    {error}
                  </Typography>
                )}

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={{
                    mt: 3,
                    mb: 2,
                    py: 1.5,
                    background: 'linear-gradient(45deg, #1DB954 30%, #1ed760 90%)',
                    boxShadow: '0 4px 20px rgba(29,185,84,0.3)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #1ed760 30%, #1DB954 90%)',
                      boxShadow: '0 6px 25px rgba(29,185,84,0.4)',
                    }
                  }}
                >
                  Sign In
                </Button>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                  <Button
                    onClick={() => setShowSignIn(false)}
                    sx={{ color: '#1DB954', textTransform: 'none' }}
                  >
                    Create Account
                  </Button>
                  <Button
                    onClick={handleGuestAccess}
                    sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}
                  >
                    Continue as Guest
                  </Button>
                </Box>
              </Box>
            </Box>

            {/* Sign Up Form */}
            <Box sx={{ width: '50%', p: 4 }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <img 
                  src={Logo} 
                  alt="FairPlay AI Logo" 
                  style={{ 
                    height: '50px', 
                    marginBottom: '12px',
                    filter: 'drop-shadow(0 4px 20px rgba(29,185,84,0.3))'
                  }} 
                />
                <Typography variant="h4" gutterBottom sx={{ 
                  fontWeight: 'bold',
                  background: 'linear-gradient(45deg, #1DB954 30%, #1ed760 90%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  Join FairPlay AI
                </Typography>
                <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Create your account today
                </Typography>
              </Box>

              <Box component="form" onSubmit={handleSignUpSubmit} sx={{ mt: 1 }}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="signup-username"
                  label="Username"
                  name="username"
                  autoComplete="username"
                  variant="outlined"
                  InputProps={{
                    startAdornment: <Person sx={{ color: 'rgba(255,255,255,0.5)', mr: 1 }} />,
                    sx: {
                      color: '#fff',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1DB954' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1DB954' }
                    }
                  }}
                  InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="signup-email"
                  label="Email Address"
                  name="email"
                  autoComplete="email"
                  variant="outlined"
                  InputProps={{
                    startAdornment: <Email sx={{ color: 'rgba(255,255,255,0.5)', mr: 1 }} />,
                    sx: {
                      color: '#fff',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1DB954' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1DB954' }
                    }
                  }}
                  InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label="Password"
                  type={showSignUpPassword ? 'text' : 'password'}
                  id="signup-password"
                  autoComplete="new-password"
                  variant="outlined"
                  InputProps={{
                    startAdornment: <Lock sx={{ color: 'rgba(255,255,255,0.5)', mr: 1 }} />,
                    endAdornment: (
                      <IconButton onClick={() => setShowSignUpPassword(!showSignUpPassword)} sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        {showSignUpPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    ),
                    sx: {
                      color: '#fff',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1DB954' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1DB954' }
                    }
                  }}
                  InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="confirmPassword"
                  label="Confirm Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirm-password"
                  variant="outlined"
                  InputProps={{
                    startAdornment: <Lock sx={{ color: 'rgba(255,255,255,0.5)', mr: 1 }} />,
                    endAdornment: (
                      <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    ),
                    sx: {
                      color: '#fff',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1DB954' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1DB954' }
                    }
                  }}
                  InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
                />

                {error && (
                  <Typography color="error" variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
                    {error}
                  </Typography>
                )}

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={signUpLoading}
                  sx={{
                    mt: 3,
                    mb: 2,
                    py: 1.5,
                    background: 'linear-gradient(45deg, #1DB954 30%, #1ed760 90%)',
                    boxShadow: '0 4px 20px rgba(29,185,84,0.3)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #1ed760 30%, #1DB954 90%)',
                      boxShadow: '0 6px 25px rgba(29,185,84,0.4)',
                    },
                    '&:disabled': {
                      background: 'rgba(29,185,84,0.5)',
                    }
                  }}
                >
                  {signUpLoading ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
                </Button>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                  <Button
                    onClick={() => setShowSignIn(true)}
                    sx={{ color: '#1DB954', textTransform: 'none' }}
                  >
                    Back to Sign In
                  </Button>
                  <Button
                    onClick={handleGuestAccess}
                    sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}
                  >
                    Continue as Guest
                  </Button>
                </Box>
              </Box>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
      
      <Footer />
    </>
  );
};

export default AnalysisPage; 