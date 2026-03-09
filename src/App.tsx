import { HashRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { PageView } from './pages/PageView';
import { Settings } from './pages/Settings';
import { Layout } from './components/Layout';
import { InstallPrompt } from './components/InstallPrompt';
import './styles/global.css';
import 'highlight.js/styles/github-dark.css';

function App() {
  return (
    <HashRouter>
      <InstallPrompt />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/page/:pageId" element={<PageView />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
