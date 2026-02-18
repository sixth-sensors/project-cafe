import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header/Header'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute'
import PublicOnlyRoute from './components/PublicOnlyRoute/PublicOnlyRoute'
import Home from './pages/Home/Home'
import Login from './pages/Login/Login'
import Signup from './pages/Signup/Signup'
import Account from './pages/Account/Account'

const App = () => {
  return (
    <BrowserRouter basename="/overbrew">
      <Header />
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<Home />} path="/" />
          <Route element={<Account />} path="/account" />
        </Route>
        <Route element={<PublicOnlyRoute />}>
          <Route element={<Login />} path="/login" />
          <Route element={<Signup />} path="/signup" />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
