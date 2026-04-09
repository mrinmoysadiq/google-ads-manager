import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import axios from 'axios'

axios.interceptors.request.use(config => {
  const token = localStorage.getItem('app_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
axios.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('app_token');
      localStorage.removeItem('app_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
