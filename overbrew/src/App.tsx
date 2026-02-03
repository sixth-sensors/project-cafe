import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/header/Header'
import Home from './pages/Home'
import Login from './pages/Login'

const App = () => {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route element={<Home />} path="/" />
        <Route element={<Login />} path="/login" />
      </Routes>
    </BrowserRouter>
  )
}

export default App
