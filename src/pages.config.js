import Dashboard from './pages/Dashboard';
import Zonas from './pages/Zonas';
import Clientes from './pages/Clientes';
import DetalleCliente from './pages/DetalleCliente';
import Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Zonas": Zonas,
    "Clientes": Clientes,
    "DetalleCliente": DetalleCliente,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: Layout,
};