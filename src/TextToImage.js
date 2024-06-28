import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import './TextToImage.css';

const TextToImage = ({ isLoggedIn, setIsLoggedIn }) => {
  const [prompts, setPrompts] = useState([""]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showExperimentPopup, setShowExperimentPopup] = useState(false); // State for experiment pop-up
  const navigate = useNavigate();

  useEffect(() => {
    setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true');
  }, [setIsLoggedIn]);

  const handlePromptChange = (index, event) => {
    if (!isLoggedIn) {
      setShowLoginPrompt(true);
      return;
    }
    const newPrompts = [...prompts];
    newPrompts[index] = event.target.value;
    setPrompts(newPrompts);
  };

  const addPrompt = () => {
    if (!isLoggedIn) {
      setShowLoginPrompt(true);
      return;
    }
    setPrompts([...prompts, ""]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isLoggedIn) {
      setShowLoginPrompt(true);
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post('http://127.0.0.1:8000/generate-images/', {
        text_prompts: prompts,
      });
      setImages(response.data.images);
    } catch (error) {
      console.error("There was an error generating the images!", error);
    }
    setLoading(false);
  };

  const handleLoginClick = () => {
    navigate('/login');
  };

  const handleSignupClick = () => {
    navigate('/signup');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.setItem('isLoggedIn', 'false');
  };

  const handleSaveImage = (image) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${image}`;
    link.download = 'generated_image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRemoveBackground = async (image) => {
    setLoading(true);
    try {
      const response = await axios.post('http://127.0.0.1:8000/remove-background/', {
        text_prompts: prompts,
      });
      setImages(response.data.images);
    } catch (error) {
      console.error("There was an error removing the background!", error);
    }
    setLoading(false);
  };

  const handleExperimentOption = () => {
    // Implement functionality for other experiment options here
    // Example:
    console.log("Experiment option clicked");
  };

  return (
    <div className="container">
      <h1>ConceptCraft</h1>
      {showLoginPrompt && (
        <div className="login-prompt">
          <p>Please log in to enter prompts</p>
          <button onClick={handleLoginClick} className="login-button">Login</button>
          <button onClick={handleSignupClick} className="signup-button">Sign Up</button>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        {prompts.map((prompt, index) => (
          <div key={index}>
            <input
              type="text"
              value={prompt}
              onChange={(event) => handlePromptChange(index, event)}
              placeholder="Enter a text prompt"
              className="input-box"
            />
          </div>
        ))}
        <button type="button" onClick={addPrompt} className="add-prompt-button">Add another prompt</button>
        <button type="submit" disabled={loading} className="generate-button">
          {loading ? "Generating..." : "Generate Images"}
        </button>
      </form>
      <div className="image-container">
        {images.map((image, index) => (
          <div key={index} className="image-item">
            <img src={`data:image/png;base64,${image}`} alt={`Generated ${index + 1}`} className="generated-image" />
            <div className="button-container">
              <button className="experiment-button" onClick={() => setShowExperimentPopup(true)}>Experiment<sup>beta</sup></button>
              <button className="save-button" onClick={() => handleSaveImage(image)}>Save Image</button>
            </div>
          </div>
        ))}
      </div>
      {showExperimentPopup && (
        <div className="experiment-popup">
          <div className="popup-content">
            <button onClick={() => setShowExperimentPopup(false)} className="close-button">X</button>
            <h2>Experiment Options</h2>
            <div className="popup-options">
              <button className="experiment-option" onClick={() => handleRemoveBackground(images[0])}>Remove Background</button>
              <button className="experiment-option" onClick={handleExperimentOption}>Option 2</button>
              <button className="experiment-option" onClick={handleExperimentOption}>Option 3</button>
              <button className="experiment-option" onClick={handleExperimentOption}>Option 4</button>
              <button className="experiment-option" onClick={handleExperimentOption}>Option 5</button>
              <button className="experiment-option" onClick={handleExperimentOption}>Option 6</button>
            </div>
          </div>
        </div>
      )}
      <div className="quote">“Creativity is Intelligence Having Fun.” -Albert Einstein</div>
      {isLoggedIn ? (
        <button onClick={handleLogout} className="logout-box">Logout</button>
      ) : (
        <>
          <Link to="/signup"><button className="sign-up-box">SignUp</button></Link>
          <Link to="/login"><button className="login-box">Login</button></Link>
        </>
      )}
    </div>
  );
};

export default TextToImage;
