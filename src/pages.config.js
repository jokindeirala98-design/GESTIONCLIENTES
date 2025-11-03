import Dashboard from './pages/Dashboard';
import Zonas from './pages/Zonas';
import Clientes from './pages/Clientes';
import Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Zonas": Zonas,
    "Clientes": Clientes,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: Layout,
};