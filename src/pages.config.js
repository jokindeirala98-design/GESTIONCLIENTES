import Dashboard from './pages/Dashboard';
import Zonas from './pages/Zonas';
import Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Zonas": Zonas,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: Layout,
};