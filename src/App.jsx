import { useState, useEffect, useRef } from 'react';
import { 
  Box, Container, Typography, TextField, Button, Paper,
  IconButton, Snackbar, ThemeProvider, Grid, Avatar,
  Drawer, List, ListItem, ListItemIcon, ListItemText,
  Switch, FormControlLabel
} from '@mui/material';
import { GoogleGenerativeAI } from '@google/generative-ai';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import SendIcon from '@mui/icons-material/Send';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import CircularProgress from '@mui/material/CircularProgress';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import axios from 'axios';
import { theme } from './theme';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// Initialize AI participants
const DEMO_PARTICIPANTS = [
  {
    name: "Albert Einstein",
    personality: "A brilliant physicist known for the theory of relativity. Speaks with deep insight about space, time, and the universe. Often uses thought experiments and analogies.",
    avatar: "",
    voiceId: "en-US-Wavenet-D"
  },
  {
    name: "Isaac Newton",
    personality: "A mathematical genius who discovered gravity. Precise and methodical in explanations. Interested in mechanics and mathematics.",
    avatar: "",
    voiceId: "en-GB-Wavenet-B"
  },
  {
    name: "Marie Curie",
    personality: "A pioneering scientist in radioactivity. Passionate about research and discovery. Speaks about persistence and the joy of scientific inquiry.",
    avatar: "",
    voiceId: "en-GB-Wavenet-C"
  },
  {
    name: "Nikola Tesla",
    personality: "A visionary inventor focused on electricity and energy. Speaks with enthusiasm about future technology and innovation.",
    avatar: "",
    voiceId: "en-US-Wavenet-B"
  },
  {
    name: "Charles Darwin",
    personality: "A naturalist who developed the theory of evolution. Observant and detail-oriented. Speaks about nature, adaptation, and the interconnectedness of life.",
    avatar: "",
    voiceId: "en-GB-Wavenet-D"
  }
];

function App() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [participants, setParticipants] = useState(DEMO_PARTICIPANTS);
  const [username, setUsername] = useState('');
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const messagesEndRef = useRef(null);
  const recognition = useRef(null);

  useEffect(() => {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window) {
      recognition.current = new webkitSpeechRecognition();
      recognition.current.continuous = true;
      recognition.current.interimResults = true;
      recognition.current.onresult = handleSpeechResult;
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSpeechResult = (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0].transcript)
      .join('');
    setInputMessage(transcript);
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognition.current?.stop();
    } else {
      recognition.current?.start();
    }
    setIsRecording(!isRecording);
  };

  const formatConversationContext = (messages) => {
    let context = 'Current participants:\n';
    participants.forEach(p => {
      context += `${p.name}: ${p.personality}\n`;
    });
    
    context += '\nConversation history:\n';
    messages.slice(-5).forEach(m => {
      context += `${m.sender}: ${m.content}\n`;
    });
    return context;
  };

  const getAIResponse = async (context) => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      
      const prompt = `You are participating in a scientific discussion. Here's the context:
${context}

Choose one of these scientists to respond as: ${participants.map(p => p.name).join(', ')}.
Respond naturally and concisely (2-3 sentences) in their voice and personality.

Format your response in JSON:
{
  "speaker": "[scientist name]",
  "message": "[your response]"
}`;

      const result = await model.generateContent(prompt);
      const response = JSON.parse(result.response.text());
      
      const speaker = participants.find(p => p.name === response.speaker);
      if (!speaker) throw new Error('Invalid speaker');
      
      return { speaker, message: response.message };
    } catch (error) {
      console.error('Error in getAIResponse:', error);
      throw error;
    }
  };

  const generateSpeech = async (text, voiceId) => {
    try {
      const response = await axios.post('https://api.murf.ai/v1/speech/generate', {
        text,
        voiceId,
        format: 'mp3'
      }, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_MURF_API_KEY}`
        }
      });
      
      return response.data.audioUrl;
    } catch (error) {
      console.error('Error generating speech:', error);
      throw error;
    }
  };

  const handleSend = async () => {
    if (!inputMessage.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      const userMessage = {
        sender: username,
        content: inputMessage.trim(),
        timestamp: new Date(),
        avatar: ''
      };
      
      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');

      const context = formatConversationContext([...messages, userMessage]);
      const aiResponse = await getAIResponse(context);
      
      const audioUrl = await generateSpeech(aiResponse.message, aiResponse.speaker.voiceId);
      
      const aiMessage = {
        sender: aiResponse.speaker.name,
        content: aiResponse.message,
        timestamp: new Date(),
        avatar: aiResponse.speaker.avatar,
        audioUrl
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      setError('Error processing message. Please try again.');
      console.error('Error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSetup = () => {
    if (!username.trim()) {
      setError('Please enter your name');
      return;
    }
    setIsSetupComplete(true);
    
    // Add welcome message
    setMessages([{
      sender: "Albert Einstein",
      content: "Welcome to our scientific discussion! I'm joined by my esteemed colleagues. Feel free to ask us anything about science, our theories, or start a discussion between us.",
      timestamp: new Date(),
      avatar: ""
    }]);
  };

  if (!isSetupComplete) {
    return (
      <ThemeProvider theme={theme}>
        <Container maxWidth="sm" sx={{ mt: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Welcome to Conversate
            </Typography>
            <TextField
              fullWidth
              label="Your Name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={demoMode}
                  onChange={(e) => setDemoMode(e.target.checked)}
                />
              }
              label="Demo Mode (Famous Scientists)"
            />
            <Button
              fullWidth
              variant="contained"
              onClick={handleSetup}
              sx={{ mt: 2 }}
            >
              Start Conversation
            </Button>
          </Paper>
        </Container>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Conversate
            </Typography>
            <IconButton color="inherit">
              <SettingsIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Container sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', py: 2 }}>
          <Grid container spacing={2} sx={{ flexGrow: 1 }}>
            <Grid item xs={12} md={9}>
              <Paper sx={{ height: '100%', p: 2, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ flexGrow: 1, overflow: 'auto', mb: 2 }}>
                  {messages.map((message, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        justifyContent: message.sender === username ? 'flex-end' : 'flex-start',
                        mb: 2
                      }}
                    >
                      <Paper
                        sx={{
                          p: 2,
                          maxWidth: '70%',
                          bgcolor: message.sender === username ? 'primary.main' : 'background.paper',
                          color: message.sender === username ? 'white' : 'text.primary'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body2" sx={{ mr: 1 }}>
                            {message.avatar}
                          </Typography>
                          <Typography variant="subtitle2">
                            {message.sender}
                          </Typography>
                        </Box>
                        <Typography>{message.content}</Typography>
                        {message.audioUrl && (
                          <audio
                            controls
                            src={message.audioUrl}
                            style={{ marginTop: 8, width: '100%' }}
                          />
                        )}
                      </Paper>
                    </Box>
                  ))}
                  <div ref={messagesEndRef} />
                </Box>

                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <IconButton
                    onClick={toggleRecording}
                    color={isRecording ? 'secondary' : 'default'}
                  >
                    {isRecording ? <MicIcon /> : <MicOffIcon />}
                  </IconButton>
                  <TextField
                    fullWidth
                    variant="outlined"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="Type your message..."
                    size="small"
                    disabled={isProcessing}
                  />
                  <IconButton
                    onClick={handleSend}
                    disabled={!inputMessage.trim() || isProcessing}
                    color="primary"
                  >
                    {isProcessing ? <CircularProgress size={24} /> : <SendIcon />}
                  </IconButton>
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} md={3}>
              <Paper sx={{ height: '100%', p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Participants
                </Typography>
                <List>
                  {participants.map((participant, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <Typography>{participant.avatar}</Typography>
                      </ListItemIcon>
                      <ListItemText primary={participant.name} />
                    </ListItem>
                  ))}
                  <ListItem>
                    <ListItemIcon>
                      <Typography></Typography>
                    </ListItemIcon>
                    <ListItemText primary={username} />
                  </ListItem>
                </List>
              </Paper>
            </Grid>
          </Grid>
        </Container>

        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          message={error}
          action={
            <IconButton size="small" color="inherit" onClick={() => setError(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        />
      </Box>
    </ThemeProvider>
  );
}

export default App;
