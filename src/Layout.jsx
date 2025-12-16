import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { 
  Home, 
  MapPin, 
  Users as UsersIcon, 
  CheckCircle2, 
  FileText, 
  DollarSign, 
  Settings, 
  Menu,
  AlertTriangle,
  X,
  LogOut,
  UserCircle2,
  Calendar as CalendarIcon
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [incidenciasPendientes, setIncidenciasPendientes] = useState(0);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        base44.auth.redirectToLogin(window.location.pathname);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    const loadIncidencias = async () => {
      if (!user) return;
      try {
        const incidencias = await base44.entities.Incidencia.list();
        if (user.role === "admin") {
          // Admin: contar activas + mensajes sin leer
          const activas = incidencias.filter(i => i.estado === "activa").length;
          const mensajesSinLeer = incidencias.reduce((count, inc) => {
            if (inc.estado === "activa" && inc.mensajes) {
              return count + inc.mensajes.filter(m => m.autor_email !== user.email && !m.leido).length;
            }
            return count;
          }, 0);
          setIncidenciasPendientes(activas + mensajesSinLeer);
        } else {
          // Comercial: contar resueltas + mensajes sin leer
          const resueltas = incidencias.filter(i => 
            i.comercial_email === user.email && i.estado === "resuelta"
          ).length;
          const mensajesSinLeer = incidencias.reduce((count, inc) => {
            if (inc.comercial_email === user.email && inc.estado === "activa" && inc.mensajes) {
              return count + inc.mensajes.filter(m => m.autor_email !== user.email && !m.leido).length;
            }
            return count;
          }, 0);
          setIncidenciasPendientes(resueltas + mensajesSinLeer);
        }
      } catch (error) {
        console.error("Error cargando incidencias:", error);
      }
    };
    loadIncidencias();
    const interval = setInterval(loadIncidencias, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#666666]">Cargando...</p>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "admin";

  // Menú para comerciales
  const menuComercial = [
    {
      title: "Zonas",
      url: createPageUrl("Zonas"),
      icon: MapPin,
    },
    {
      title: "Clientes",
      url: createPageUrl("Clientes"),
      icon: UsersIcon,
    },
    {
      title: "Calendario",
      url: createPageUrl("Calendario"),
      icon: CalendarIcon,
    },
    {
      title: "Ready to Go",
      url: createPageUrl("ReadyToGo"),
      icon: CheckCircle2,
    },
    {
      title: "Comisiones",
      url: createPageUrl("Comisiones"),
      icon: DollarSign,
    },
    {
      title: "Incidencias",
      url: createPageUrl("Incidencias"),
      icon: AlertTriangle,
    },
    {
      title: "Configuración",
      url: createPageUrl("Configuracion"),
      icon: Settings,
    },
    ];

    // Menú para administradores
    const menuAdmin = [
    {
      title: "Calendario",
      url: createPageUrl("Calendario"),
      icon: CalendarIcon,
    },
    {
      title: "Informes por Presentar",
      url: createPageUrl("InformesPorPresentar"),
      icon: FileText,
    },
    {
      title: "Zonas",
      url: createPageUrl("Zonas"),
      icon: MapPin,
    },
    {
      title: "Clientes",
      url: createPageUrl("Clientes"),
      icon: UsersIcon,
    },
    {
      title: "Cierres Verificados",
      url: createPageUrl("CierresVerificados"),
      icon: CheckCircle2,
    },
    {
      title: "Comisiones",
      url: createPageUrl("ComisionesAdmin"),
      icon: DollarSign,
    },
    {
      title: "Incidencias",
      url: createPageUrl("Incidencias"),
      icon: AlertTriangle,
    },
    {
      title: "Gestión de Usuarios",
      url: createPageUrl("GestionUsuarios"),
      icon: UserCircle2,
    },
    {
      title: "Configuración",
      url: createPageUrl("Configuracion"),
      icon: Settings,
    },
    ];

  const navigationItems = isAdmin ? menuAdmin : menuComercial;

  const handleLogout = () => {
    base44.auth.logout();
  };

  const SidebarNav = () => (
    <>
      <SidebarHeader className="border-b border-gray-200 p-4 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#004D9D] to-[#00AEEF] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">V</span>
          </div>
          <div>
            <h2 className="font-bold text-[#004D9D] text-sm">Voltis Energía</h2>
            <p className="text-xs text-[#666666]">Gestor de Clientes</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="p-2 bg-[#F5F5F5]">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className={`hover:bg-white hover:text-[#004D9D] transition-all duration-200 rounded-lg mb-1 ${
                      location.pathname === item.url 
                        ? 'bg-[#004D9D] text-white hover:bg-[#004D9D] hover:text-white' 
                        : 'text-[#666666]'
                    }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5">
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium text-sm">{item.title}</span>
                      {item.title === "Incidencias" && incidenciasPendientes > 0 && (
                        <span className={`ml-auto flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full ${
                          user.role === "admin" ? "bg-red-500" : "bg-green-500"
                        } text-white`}>
                          {incidenciasPendientes}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-gray-200 p-4 bg-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 bg-gradient-to-br from-[#00AEEF] to-[#004D9D] rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">{user.iniciales || user.full_name?.substring(0, 2).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[#004D9D] text-sm truncate">{user.full_name}</p>
              <p className="text-xs text-[#666666] truncate">{isAdmin ? 'Administrador' : 'Comercial'}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-[#666666] hover:text-red-600 hover:bg-red-50 flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <SidebarProvider>
          <div className="flex min-h-screen">
            <Sidebar className="border-r border-gray-200 bg-white">
              <SidebarNav />
            </Sidebar>
            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </SidebarProvider>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        {/* Mobile Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-[#004D9D]">
                    <Menu className="w-6 h-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-[280px] bg-white">
                  <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="border-b border-gray-200 p-4 bg-white">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#004D9D] to-[#00AEEF] rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold text-lg">V</span>
                        </div>
                        <div>
                          <h2 className="font-bold text-[#004D9D] text-sm">Voltis Energía</h2>
                          <p className="text-xs text-[#666666]">Gestor de Clientes</p>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="flex-1 overflow-auto p-2 bg-[#F5F5F5]">
                      <nav className="space-y-1">
                        {navigationItems.map((item) => (
                          <Link
                            key={item.title}
                            to={item.url}
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                              location.pathname === item.url
                                ? 'bg-[#004D9D] text-white'
                                : 'text-[#666666] hover:bg-white hover:text-[#004D9D]'
                            }`}
                          >
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium text-sm">{item.title}</span>
                            {item.title === "Incidencias" && incidenciasPendientes > 0 && (
                              <span className={`ml-auto flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full ${
                                user.role === "admin" ? "bg-red-500" : "bg-green-500"
                              } text-white`}>
                                {incidenciasPendientes}
                              </span>
                            )}
                          </Link>
                        ))}
                      </nav>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-200 p-4 bg-white">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-9 h-9 bg-gradient-to-br from-[#00AEEF] to-[#004D9D] rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-sm">
                              {user.iniciales || user.full_name?.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[#004D9D] text-sm truncate">{user.full_name}</p>
                            <p className="text-xs text-[#666666] truncate">
                              {isAdmin ? 'Administrador' : 'Comercial'}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleLogout}
                          className="text-[#666666] hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                        >
                          <LogOut className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              <h1 className="font-bold text-[#004D9D] text-lg">Voltis</h1>
            </div>
            <div className="w-8 h-8 bg-gradient-to-br from-[#00AEEF] to-[#004D9D] rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xs">{user.iniciales || user.full_name?.substring(0, 2).toUpperCase()}</span>
            </div>
          </div>
        </header>

        {/* Mobile Content */}
        <main className="pb-4">
          {children}
        </main>
      </div>

      <style>{`
        :root {
          --voltis-blue: #004D9D;
          --voltis-blue-light: #00AEEF;
          --voltis-gray: #666666;
          --voltis-gray-light: #F5F5F5;
        }
      `}</style>
    </div>
  );
}