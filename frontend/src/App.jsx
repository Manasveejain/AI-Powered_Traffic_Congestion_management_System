import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar    from './components/Navbar'
import Dashboard from './pages/DashBoard'
import MapView   from './pages/MapView'
import RoutesPage from './pages/Routes'
import Alerts    from './pages/Alerts'
import Chatbot   from './pages/Chatbot'
import Emergency from './pages/Emergency'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-white">
        <Navbar />
        <main className="p-4">
          <Routes>
            <Route path="/"          element={<Dashboard />}  />
            <Route path="/map"       element={<MapView />}    />
            <Route path="/routes"    element={<RoutesPage />} />
            <Route path="/alerts"    element={<Alerts />}     />
            <Route path="/chatbot"   element={<Chatbot />}    />
            <Route path="/emergency" element={<Emergency />}  />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}