import React, { useState } from 'react';

const AccordionItem: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border-b border-brand-border">
            <button
                className="flex justify-between items-center w-full py-5 text-left text-brand-text"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
            >
                <span className="text-lg font-semibold">{title}</span>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-6 w-6 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && (
                <div className="pb-5 pr-4 pl-2 text-brand-text-secondary space-y-4 leading-relaxed">
                    {children}
                </div>
            )}
        </div>
    );
};

export const HelpView: React.FC = () => {
    const P = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;
    const H3 = ({ children }: { children: React.ReactNode }) => <h3 className="text-lg font-semibold text-brand-text mt-4 mb-2">{children}</h3>;
    const UL = ({ children }: { children: React.ReactNode }) => <ul className="list-disc list-outside ml-5 space-y-2">{children}</ul>;
    const OL = ({ children }: { children: React.ReactNode }) => <ol className="list-decimal list-outside ml-5 space-y-2">{children}</ol>;
    const LI = ({ children }: { children: React.ReactNode }) => <li>{children}</li>;
    const B = ({ children }: { children: React.ReactNode }) => <strong className="font-semibold text-brand-text">{children}</strong>;
    const C = ({ children }: { children: React.ReactNode }) => <code className="bg-brand-bg text-yellow-300 font-mono text-sm px-1.5 py-1 rounded-md">{children}</code>;

    return (
        <div className="max-w-4xl mx-auto bg-brand-surface rounded-lg p-8 shadow-lg animate-fade-in">
            <h2 className="text-3xl font-bold text-brand-text mb-2">Centro de Ayuda</h2>
            <p className="text-brand-text-secondary mb-8">
                Encuentra respuestas a preguntas comunes y guías para usar la aplicación.
            </p>

            <div className="space-y-2">
                <AccordionItem title="1. Primeros Pasos" defaultOpen={true}>
                    <P>Para empezar a usar la aplicación, sigue estos pasos iniciales:</P>
                    <UL>
                        <LI><B>Configurar la Base de Datos:</B> Ve a la pestaña <C>Configuración</C>. La app usa una base de datos simulada en tu navegador (LocalStorage). Los datos de conexión vienen pre-rellenados. Solo tienes que hacer clic en <B>"Probar y Guardar Conexión"</B>. Si la conexión es exitosa, el indicador de estado en la barra de navegación cambiará a verde.</LI>
                        <LI><B>Iniciar Sesión:</B> La primera vez que uses la app, no habrá usuarios. Inicia sesión con el usuario por defecto: <C>Admin</C> y contraseña <C>Admin</C>. Una vez dentro, se recomienda ir a la pestaña <C>Usuarios</C> y cambiar la contraseña.</LI>
                        <LI><B>Crear un Cliente:</B> Antes de analizar un creativo, debes tener al menos un cliente. Ve a la pestaña <C>Clientes</C> y haz clic en <B>"Añadir Cliente"</B>. Rellena el nombre, la moneda de su cuenta publicitaria y, opcionalmente, un logo.</LI>
                    </UL>
                </AccordionItem>

                <AccordionItem title="2. Cómo Analizar Creativos">
                    <P>El núcleo de la aplicación es el análisis de creativos mediante IA. El flujo de trabajo es el siguiente:</P>
                    <OL>
                        <LI><B>Subir Creativo:</B> En la vista principal (<C>Análisis de Creativos</C>), arrastra y suelta una imagen o video, o haz clic para seleccionarlo.</LI>
                        <LI><B>Asignar Cliente:</B> Se te pedirá que asignes el creativo a uno de tus clientes. Esto es crucial para mantener los análisis organizados y usar el historial del cliente como contexto para la IA.</LI>
                        <LI><B>Seleccionar Formato:</B> Una vez asignado, deberás elegir un grupo de formatos para el análisis: <C>Formatos Cuadrados/Rectangulares</C> (para Feeds, etc.) o <C>Formatos Verticales</C> (para Stories, Reels).</LI>
                        <LI><B>Interpretar el Análisis:</B> La IA generará un reporte completo que incluye:
                            <UL>
                                <LI><B>Puntuaciones:</B> Efectividad y Claridad para una evaluación rápida.</LI>
                                <LI><B>Zonas de Riesgo:</B> Una vista previa que muestra las áreas donde la interfaz de Meta podría tapar elementos clave de tu creativo.</LI>
                                <LI><B>Recomendaciones:</B> Consejos específicos para mejorar el rendimiento del anuncio.</LI>
                                <LI><B>Análisis Advantage+:</B> Sugerencias sobre qué mejoras automáticas de Meta activar.</LI>
                                <LI><B>Conclusión:</B> Un resumen accionable con los puntos más importantes.</LI>
                            </UL>
                        </LI>
                    </OL>
                </AccordionItem>

                <AccordionItem title="3. Gestión de Rendimiento (Importar XLSX)">
                    <P>Puedes cruzar los análisis cualitativos de la IA con datos cuantitativos de tus reportes de Meta Ads.</P>
                    <UL>
                        <LI><B>Importar Reporte (Admin):</B> En la pestaña <C>Importar</C>, sube el archivo XLSX que contiene el rendimiento de todas tus campañas. El sistema procesará los datos y los guardará en la base de datos simulada.</LI>
                        <LI><B>Vinculación de Datos:</B> La aplicación intenta vincular cada fila del reporte con un creativo analizado previamente. La vinculación se realiza mediante una estrategia robusta en varios pasos:
                            <OL>
                                <LI>Busca si el nombre del archivo original (ej: <C>mi_creativo.png</C>) está contenido en el campo <C>"Imagen, video y presentación"</C> del reporte.</LI>
                                <LI>Si no hay coincidencia, compara una versión "limpia" del nombre del archivo con el campo <C>"Nombre de la imagen"</C>.</LI>
                                <LI>Como último recurso, busca el <C>"Identificador de la imagen"</C> del reporte dentro del nombre del archivo original.</LI>
                            </OL>
                        </LI>
                        <LI><B>Ver Rendimiento:</B> En la pestaña <C>Rendimiento</C>, puedes ver un resumen por cliente. Al hacer clic en un cliente, verás una tabla o tarjetas con el rendimiento de cada anuncio. Los anuncios vinculados a un análisis de IA se marcarán con un ícono especial.</LI>
                        <LI><B>Conclusión de IA:</B> En la vista de detalle de un cliente, puedes solicitar una conclusión estratégica de la IA, que analizará los anuncios vinculados y te dará recomendaciones basadas en los que tuvieron mejor y peor rendimiento.</LI>
                    </UL>
                </AccordionItem>
                
                <AccordionItem title="4. Análisis Estratégico Integral (NUEVO)">
                    <P>La funcionalidad más avanzada que combina el análisis de creativos por IA con métricas de rendimiento para generar un plan de acción estratégico completo.</P>
                    
                    <H3>📋 ¿Qué es el Análisis Estratégico Integral?</H3>
                    <P>Esta funcionalidad toma todos los creativos que ya analizaste con IA, los combina con los datos de rendimiento importados, y genera un <B>plan estratégico completo</B> usando IA avanzada.</P>
                    
                    <H3>🎯 Requisitos Previos</H3>
                    <UL>
                        <LI><B>Creativos Analizados:</B> Debes tener creativos analizados por IA en la pestaña "Análisis de Creativos"</LI>
                        <LI><B>Datos de Rendimiento:</B> Debes haber importado datos de rendimiento (archivos XLSX de Meta)</LI>
                        <LI><B>Datos Vinculados:</B> Los creativos deben estar correctamente vinculados con los datos de rendimiento</LI>
                    </UL>
                    
                    <H3>🚀 Cómo Usar</H3>
                    <OL>
                        <LI><B>Ve a "Plan Estratégico"</B> en el menú principal</LI>
                        <LI><B>Selecciona un Cliente:</B> Solo aparecerán clientes que tengan creativos analizados Y datos de rendimiento</LI>
                        <LI><B>Selecciona Período:</B> Ajusta las fechas para el análisis</LI>
                        <LI><B>Genera Análisis:</B> Haz clic en "Generar Análisis Estratégico"</LI>
                        <LI><B>Revisa el Plan:</B> La IA generará un plan completo con acciones priorizadas</LI>
                    </OL>
                    
                    <H3>📊 ¿Qué Obtienes?</H3>
                    <UL>
                        <LI><B>Resumen Ejecutivo:</B> Análisis holístico que conecta calidad de creativos con rendimiento real</LI>
                        <LI><B>Plan de Acción:</B> 4-6 acciones estratégicas priorizadas (Alta/Media/Baja prioridad) con timelines e impacto esperado</LI>
                        <LI><B>Insights por Creativo:</B> Conexión específica entre el análisis de IA y rendimiento de cada anuncio</LI>
                        <LI><B>Recomendaciones de Rendimiento:</B> Categorizadas por Presupuesto, Targeting, Creativos, Pujas y Placements</LI>
                    </UL>
                    
                    <H3>💡 Ejemplo de Análisis</H3>
                    <P>La IA podría generar algo como:</P>
                    <P><B>"Los creativos con puntuaciones de efectividad superiores a 70 están generando un ROAS 40% más alto. Recomiendo escalar el presupuesto del 'Summer Glow Campaign' en un 50% y optimizar los 2 creativos con problemas en zonas seguras para Stories."</B></P>
                    
                    <H3>🎯 Casos de Uso</H3>
                    <UL>
                        <LI><B>Reportes para Clientes:</B> Genera reportes ejecutivos completos</LI>
                        <LI><B>Optimización Guiada:</B> Sigue un plan paso a paso basado en datos reales</LI>
                        <LI><B>Priorización:</B> Entiende qué acciones tendrán mayor impacto</LI>
                        <LI><B>Correlaciones:</B> Descubre patrones entre calidad creativa y rendimiento</LI>
                    </UL>
                </AccordionItem>
                
                <AccordionItem title="5. Funciones de Administrador">
                    <P>Si tienes rol de <B>Admin</B>, tienes acceso a vistas y funciones adicionales:</P>
                    <UL>
                        <LI><B>Importar:</B> Permite subir el reporte maestro XLSX con datos de todas las cuentas.</LI>
                        <LI><B>Usuarios:</B> Permite crear, editar y eliminar usuarios de la aplicación.</LI>
                        <LI><B>Panel de Control:</B> Ofrece una vista de bajo nivel de la "base de datos". Puedes ver el estado de las "tablas", crearlas si es necesario, y realizar acciones de limpieza, como borrar todo el historial de análisis o resetear por completo los datos de la aplicación. <B>Usa esta sección con cuidado.</B></LI>
                        <LI><B>Clientes:</B> Un administrador puede ver y gestionar los clientes de todos los usuarios, no solo los propios.</LI>
                    </UL>
                </AccordionItem>
            </div>
        </div>
    );
};
