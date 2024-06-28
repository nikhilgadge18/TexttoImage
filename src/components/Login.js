import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import './Login.css';

const Login = ({ setIsLoggedIn }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new URLSearchParams();
    data.append('username', formData.username);
    data.append('password', formData.password);

    try {
      const response = await axios.post('http://127.0.0.1:8000/token', data, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      if (response.status === 200) {
        setMessage('Login successful');
        setIsLoggedIn(true);
        localStorage.setItem('isLoggedIn', 'true'); // Set login status in localStorage
        navigate('/');
      } else {
        setMessage('Login failed');
      }
    } catch (error) {
      console.error("Login error:", error.response || error.message || error);
      setMessage('Login failed: ' + (error.response?.data?.detail || error.message || 'Unknown error'));
    }
  };

  return (
    <div className="login-container">
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="username"
          value={formData.username}
          onChange={handleChange}
          placeholder="Username"
          required
          className="input-box"
        />
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Password"
          required
          className="input-box"
        />
        <button type="submit" className="login-button">Login</button>
      </form>
      {message && <p>{message}</p>}
      <Link to="/signup"><button className="signup-button">Sign Up</button></Link>
    </div>
  );
};

export default Login;
