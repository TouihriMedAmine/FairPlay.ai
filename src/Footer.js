import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from './config';
import {
  Box, Container, Grid, Typography, Link, IconButton,
  Divider, Chip
} from '@mui/material';
import {
  Facebook, Twitter, LinkedIn, Instagram, Email, LocationOn,
  Business, Language
} from '@mui/icons-material';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const [radioStations, setRadioStations] = useState([]);

  useEffect(() => {
    const fetchRadioStations = async () => {
      try {
        const response = await axios.get(API_ENDPOINTS.SONGS);
        const allData = response.data;
        
        // Extract unique radio stations
        const uniqueStations = [...new Set(allData.map(song => song.radio_name).filter(Boolean))];
        setRadioStations(uniqueStations);
      } catch (error) {
        console.error("Error fetching radio stations:", error);
        // Fallback to default stations if API fails
        setRadioStations(['Mosaique FM', 'IFM', 'Express FM', 'Jawhara FM', 'Radio Nationale']);
      }
    };

    fetchRadioStations();
  }, []);

  // Divide radio stations into 3 columns
  const divideIntoColumns = (stations, columns = 3) => {
    const result = Array.from({ length: columns }, () => []);
    stations.forEach((station, index) => {
      result[index % columns].push(station);
    });
    return result;
  };

  const stationColumns = divideIntoColumns(radioStations);

  return (
    <Box
      sx={{
        background: (theme) => theme.palette.mode === 'light' 
          ? 'linear-gradient(180deg, #E9E9E9 0%, #f7f7f7 100%)' 
          : '#0a0a0a',
        color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff',
        borderTop: (theme) => theme.palette.mode === 'light' ? '1px solid #e5e7eb' : '1px solid rgba(255, 255, 255, 0.1)',
        mt: 'auto',
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} sx={{ py: 4 }}>
          {/* Company Info */}
          <Grid item xs={12} md={4}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="h5" sx={{ color: '#1DB954', mb: 1, fontWeight: 'bold' }}>
                FairPlay AI
              </Typography>
              <Typography variant="body2" sx={{ color: (theme) => theme.palette.mode === 'light' ? '#555' : '#ccc', mb: 2 }}>
                Discover who gets played and when. Track music plays across major Tunisian radios,
                analyze artist airplay, and bring fairness to the music industry.
              </Typography>
              <Chip
                label="Powered by LaFormatik.ai"
                sx={{
                  backgroundColor: '#1DB954',
                  color: '#fff',
                  fontWeight: 'bold',
                  '&:hover': { backgroundColor: '#1ed760' }
                }}
              />
            </Box>
          </Grid>

          {/* Quick Links */}
          <Grid item xs={12} md={2}>
            <Typography variant="h6" sx={{ mb: 2, color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff' }}>
              Platform
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Link href="/home" sx={{ color: (theme) => theme.palette.mode === 'light' ? '#444' : '#ccc', textDecoration: 'none', '&:hover': { color: '#1DB954' } }}>
                Songs List
              </Link>
              <Link href="/analysis" sx={{ color: (theme) => theme.palette.mode === 'light' ? '#444' : '#ccc', textDecoration: 'none', '&:hover': { color: '#1DB954' } }}>
                Analytics
              </Link>
              <Link href="/authentication" sx={{ color: (theme) => theme.palette.mode === 'light' ? '#444' : '#ccc', textDecoration: 'none', '&:hover': { color: '#1DB954' } }}>
                Login
              </Link>
            </Box>
          </Grid>

          {/* Radio Stations - Dynamic 3 Columns */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" sx={{ mb: 2, color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff' }}>
              Radio Stations
            </Typography>
            <Grid container spacing={2}>
              {stationColumns.map((column, colIndex) => (
                <Grid item xs={4} key={colIndex}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {column.map((station, stationIndex) => (
                      <Typography
                        key={stationIndex}
                        variant="body2"
                        sx={{
                          color: (theme) => theme.palette.mode === 'light' ? '#444' : '#ccc',
                          cursor: 'pointer',
                          '&:hover': {
                            color: '#1DB954',
                            transition: 'color 0.3s ease'
                          }
                        }}
                      >
                        {station}
                      </Typography>
                    ))}
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Contact Info */}
          <Grid item xs={12} md={2}>
            <Typography variant="h6" sx={{ mb: 2, color: (theme) => theme.palette.mode === 'light' ? '#111' : '#fff' }}>
              Contact LaFormatik.ai
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Business sx={{ color: '#1DB954', fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: (theme) => theme.palette.mode === 'light' ? '#444' : '#ccc' }}>
                  LaFormatik.ai - Tunisian Platform for Intelligent Solutions
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocationOn sx={{ color: '#1DB954', fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: (theme) => theme.palette.mode === 'light' ? '#444' : '#ccc' }}>
                  Tunisia
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Email sx={{ color: '#1DB954', fontSize: 20 }} />
                <Link href="mailto:contact@laformatik.ai" sx={{ color: (theme) => theme.palette.mode === 'light' ? '#444' : '#ccc', textDecoration: 'none', '&:hover': { color: '#1DB954' } }}>
                  contact@laformatik.ai
                </Link>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Language sx={{ color: '#1DB954', fontSize: 20 }} />
                <Link href="https://laformatik.ai" target="_blank" sx={{ color: (theme) => theme.palette.mode === 'light' ? '#444' : '#ccc', textDecoration: 'none', '&:hover': { color: '#1DB954' } }}>
                  laformatik.ai
                </Link>
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ borderColor: (theme) => theme.palette.mode === 'light' ? '#e5e7eb' : 'rgba(255, 255, 255, 0.1)' }} />

        {/* Bottom Section */}
        <Box sx={{ py: 3, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" sx={{ color: (theme) => theme.palette.mode === 'light' ? '#666' : '#888' }}>
            © {currentYear} FairPlay AI. All rights reserved.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              href="https://facebook.com/laformatik.ai"
              target="_blank"
              sx={{ color: (theme) => theme.palette.mode === 'light' ? '#444' : '#ccc', '&:hover': { color: '#1DB954' } }}
            >
              <Facebook />
            </IconButton>
            <IconButton
              href="https://twitter.com/laformatik_ai"
              target="_blank"
              sx={{ color: (theme) => theme.palette.mode === 'light' ? '#444' : '#ccc', '&:hover': { color: '#1DB954' } }}
            >
              <Twitter />
            </IconButton>
            <IconButton
              href="https://linkedin.com/company/laformatik-ai"
              target="_blank"
              sx={{ color: (theme) => theme.palette.mode === 'light' ? '#444' : '#ccc', '&:hover': { color: '#1DB954' } }}
            >
              <LinkedIn />
            </IconButton>
            <IconButton
              href="https://instagram.com/laformatik.ai"
              target="_blank"
              sx={{ color: (theme) => theme.palette.mode === 'light' ? '#444' : '#ccc', '&:hover': { color: '#1DB954' } }}
            >
              <Instagram />
            </IconButton>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer; 