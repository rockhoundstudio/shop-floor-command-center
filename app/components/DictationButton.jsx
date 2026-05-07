import { useState, useEffect, useRef } from "react";
import { Button, Tooltip } from "@shopify/polaris";

export default function DictationButton({ onResult, placeholder = "🎤 Click to Speak" }) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Check if the browser supports the free Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (onResult) {
        onResult(transcript);
      }
    };

    recognition.onerror = (event) => {
      console.error("Microphone error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
  }, [onResult]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  if (!supported) {
    return <Button disabled>🎙️ Browser Not Supported</Button>;
  }

  return (
    <Tooltip content={isListening ? "Listening... Speak now." : "Click and start speaking"}>
      <Button
        onClick={toggleListening}
        pressed={isListening}
        tone={isListening ? "critical" : "success"}
        size="large"
      >
        {isListening ? "🛑 Listening... (Click to Stop)" : placeholder}
      </Button>
    </Tooltip>
  );
}