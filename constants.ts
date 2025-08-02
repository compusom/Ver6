
import { Placement, PlacementId, FormatGroup, UiType } from './types';

export const META_ADS_GUIDELINES = `
### Mejoras automáticas de Meta Advantage+ para anuncios estáticos y de video

#### Plantilla de imagen (superposición de texto Advantage+)
La plantilla de imagen es una mejora Advantage+ que superpone texto sobre tu anuncio estático cuando esto puede mejorar su rendimiento. Meta utiliza plantillas de diseño para mostrar en la creatividad frases o mensajes clave que tú hayas proporcionado (por ejemplo, titulares o promociones) directamente encima de la imagen. Esta superposición de texto, con fuente y fondo personalizables, hace que tu mensaje sea más visible dentro del anuncio, sin depender de que el usuario lea el texto fuera de la imagen. En la práctica, cubre una parte del creativo con texto destacado, por lo que conviene evitar colocar elementos importantes de la imagen en la zona donde podría ir la superposición (usualmente zonas superior o inferior). Esta función se entrega en ubicaciones como Feed móvil, Feed de Instagram y Reels de Facebook. (Ejemplo: Meta puede colocar automáticamente un texto tipo "¡Oferta especial esta semana!” sobre tu imagen para captar la atención del público.)

#### Retoques visuales (ajuste de brillo, contraste y formato)
Los retoques visuales permiten que Meta optimice automáticamente la calidad visual de tu imagen. Esta mejora Advantage+ puede ajustar el brillo y contraste de la foto, aplicar ligeros filtros de color, e incluso recortar o reencuadrar el contenido para adaptarlo mejor a distintas ubicaciones o formatos. El objetivo es hacer que el anuncio luzca más limpio, claro y profesional sin alterar el mensaje central. Por ejemplo, si tu imagen original es muy oscura o tiene un encuadre horizontal, Meta podría aclararla y recortarla a cuadrado o vertical para que destaque en el feed. Ten en cuenta que podría recortar bordes de la imagen al cambiar la relación de aspecto, por lo que debes considerar mantener el sujeto principal centrado y con margen de seguridad. En general, esta mejora ayuda a que tus anuncios sean más llamativos visualmente, aumentando la probabilidad de que los usuarios se detengan a mirarlos.

#### Animación de imagen estática (movimiento automático)
La animación de imagen convierte una foto estática en un contenido con movimiento sutil. Meta añadirá movimientos comunes como panorámicas, zoom o rotaciones a tu imagen cuando estime que así puede captar mejor la atención del público. En la práctica, tu creatividad estática se transforma en un breve video o GIF con efecto de movimiento, enfocándose típicamente en el centro de la imagen para aplicar el zoom o paneo. Esto puede hacer más dinámico un anuncio normalmente plano, destacándolo en el feed o en Stories. Sin embargo, toda la imagen se ve afectada: puede que los bordes queden ligeramente fuera de cuadro durante el movimiento o que el efecto distraiga del mensaje principal. Meta solo aplica esta animación cuando cree que beneficiará el rendimiento, pero si la animación no encaja con tu estética, puedes desactivar esta mejora. (Ejemplo: una foto de un producto podría tener un ligero zoom in-out o un desplazamiento de lado a lado para darle vida en el feed.)

#### Animación 3D (efecto de profundidad)
La mejora de animación 3D le da un efecto de profundidad o tridimensionalidad a tu imagen estática para hacerla más llamativa. Meta utiliza inteligencia artificial para separar capas (sujeto y fondo) y aplicar un movimiento 3D sutil, de modo que el producto o elemento principal parezca sobresalir o moverse ligeramente en un espacio tridimensional. Esto se muestra en ubicaciones como Stories, Feed de Instagram y Reels, donde el efecto sorprende al usuario y puede detener el desplazamiento. Visualmente, afecta a toda la imagen, añadiendo animación de profundidad que puede inclinar o escalar partes de la foto. Si bien este efecto puede captar la atención por novedad, a veces no encaja con el mensaje o hace que el anuncio se vea menos realista. Conviene usarlo solo si la imagen se presta al efecto (por ejemplo, producto sobre fondo simple). (Ejemplo: una foto de calzado podría tener un ligero efecto 3D donde el zapato “salta” un poco hacia adelante mientras el fondo se aleja).

#### Ampliación de imagen (expandir para más ubicaciones)
La ampliación de imagen es una mejora potenciada por IA generativa que expande automáticamente tu imagen para adaptarla a más formatos y tamaños de pantalla. Meta genera píxeles adicionales en los bordes de tu foto para cambiar su proporción (por ejemplo, de horizontal a vertical), permitiendo utilizarla en ubicaciones como Stories o Reels sin dejar franjas vacías. En esencia, extiende el fondo de tu imagen de forma coherente: por ejemplo, añade cielo, suelo u otros elementos similares al contenido original para llenar el espacio extra. Esta expansión cubre áreas fuera de tu imagen original, manteniendo el sujeto central visible. Además, Meta puede añadir superposiciones de texto en la zona expandida cuando crea que así mejorará el rendimiento (por ejemplo, un breve mensaje promocional en la parte superior o inferior añadida). Es importante saber que la IA hace su mejor intento, pero los resultados pueden variar en fidelidad; Meta misma advierte que no garantiza la exactitud de las imágenes expandidas. En resumen, esta mejora te ahorra crear versiones específicas para cada formato, aunque debes revisar que los elementos esenciales no queden distorsionados ni que el contenido generado resulte inapropiado.

#### Música de fondo (optimización musical)
La mejora de música añade una pista de audio a tu anuncio para hacerlo más envolvente en plataformas con sonido, como Reels o secciones de video. Si tu anuncio es una imagen estática o un video sin audio, Meta puede convertirlo en un video con música, eligiendo automáticamente una canción de su biblioteca libre de regalías que encaje con tu contenido y con las tendencias musicales. Por ejemplo, podría seleccionar una melodía suave para un anuncio de moda o algo más enérgico para un producto deportivo (también tienes la opción de escoger la pista manualmente filtrando por género, artista, tempo, etc. en la biblioteca). Esta mejora no altera la imagen o video visualmente, pero convierte a formato video a un anuncio estático y agrega un componente sonoro que puede captar la atención de usuarios con volumen activado. Ten en cuenta que la elección automática no siempre será perfecta, a veces la música podría no ajustarse al tono de tu marca o mensaje. Si el audio no es adecuado (por ejemplo, un anuncio corporativo con música demasiado estridente), puede distraer o restar profesionalidad. Lo recomendable es usar esta función si el contexto de la plataforma lo amerita (muchos usuarios con sonido activado) y revisar la selección de pista para asegurarse de que complemente y no contradiga la atmósfera de tu anuncio.

#### Mostrar productos del catálogo
Mostrar productos del catálogo (Add Catalog Items) permite combinar tus anuncios estándar con elementos de tu catálogo de productos de forma dinámica. Si activas esta mejora y tu cuenta tiene un catálogo de productos vinculado, Meta automáticamente insertará uno o varios productos relevantes dentro de tu anuncio estático, de video o carrusel. En la práctica, el anuncio podría volverse un formato mixto: por ejemplo, junto a tu imagen o video principal aparecerá un carrusel desplazable con productos de tu catálogo, o se anexará un módulo debajo de tu creativo mostrando artículos relacionados con precio y enlace. Esto facilita que la audiencia descubra productos específicos sin salir del anuncio, haciendo más eficiente el llamado a la acción. Visualmente, significa que parte del espacio publicitario mostrará fotos de productos extraídas de tu feed (con su título, precio u oferta), usualmente debajo o al lado de tu contenido principal dependiendo de la ubicación. Es una forma de aprovechar el rendimiento de los anuncios dinámicos incluso en anuncios comunes, ya que cada persona verá productos del catálogo adaptados a sus intereses o su actividad previa. Al diseñar tu creativo, considera que habrá otros elementos visuales (las miniaturas de producto) compartiendo pantalla, mantén tu imagen principal sencilla y complementaria a esos productos adicionales para que el anuncio no se sienta desordenado. (Ejemplo: un anuncio con la foto de una modelo podría automáticamente mostrar debajo varias prendas de tu catálogo que la persona puede comprar, con sus precios y un botón “Comprar").

#### CTA mejorado (llamada a la acción destacada)
El CTA mejorado (Enhance CTA) es una mejora que resalta el llamado a la acción de tu anuncio para que los usuarios no lo pasen por alto. Meta puede modificar el tamaño, color o posición del botón CТА, o generar una superposición gráfica en ciertos placements, con el fin de hacerlo más visible dentro del anuncio. Esta función ha demostrado ser especialmente útil en historias (Stories) de Instagram o Facebook, donde a veces el CTA ("Ver más”, “Comprar", etc.) es fácil de ignorar. En Stories, lo que hace es añadir un overlay con frases clave junto al CTA, usando términos promocionales detectados en tu texto para enfatizar la oferta. Por ejemplo, si tu texto menciona “50% de descuento", podría aparecer en la historia un rótulo junto al botón "Comprar” diciendo “50% OFF - Compra ya". De este modo, combina tu mensaje principal con la llamada a la acción para estimular al usuario. Visualmente, ocupa la parte inferior de la pantalla en Stories (donde está el swipe up o botón), añadiendo ese texto sobre el video/imagen, mientras que en Feed podría simplemente hacer que el botón estándar destaque más (con un color llamativo, por ejemplo). Al usar CTA mejorado, ten cuidado de no duplicar mensajes: si tu creatividad ya incluye un botón o texto de CTA muy claro integrado en el diseño, esta mejora podría redundar y recargar la imagen. En cambio, es muy útil cuando tu anuncio no tenía un CTA visual fuerte, ya que Meta se asegurará de que la acción deseada quede clara para el usuario. (Ejemplo: en una Historia de Instagram donde solo tenías un video mostrando el producto, Meta podría añadir al final un texto sobre el botón “Más información” que diga “Compra con 10% de descuento hoy").

#### Superposiciones adicionales (gráficos o etiquetas sobre la imagen)
Esta mejora permite a Meta agregar gráficos o etiquetas de manera automática encima de tu anuncio, por ejemplo, un distintivo de "En oferta", "Envío gratis" u otros elementos decorativos, cuando considera que puede mejorar la performance. A diferencia de la plantilla de imagen (que usa tu propio texto), aquí se trata de elementos extra que no estaban en tu creativo original. En el caso de anuncios de catálogo dinámico, Meta puede superponer información del producto directamente en la imagen, como el porcentaje de descuento o el precio tachado, para destacar una promoción. En anuncios estáticos normales, podría agregar una etiqueta o gráfico predefinido, como un ícono de oferta relámpago, aunque esta práctica suele ser limitada. Si bien en teoría estas superposiciones llaman la atención sobre datos importantes, en la práctica pueden recargar o desordenar la imagen y quitarle profesionalismo. Ten en cuenta que cualquier overlay ocupará alguna esquina o borde de tu creativo (por ejemplo, un sello de descuento en la esquina superior), por lo que podría tapar parte de la foto. Muchos anunciantes prefieren desactivar este tipo de mejora si el diseño del anuncio ya está optimizado, ya que un agregado automático podría no coincidir con la estética de la marca. Si decides usarlas, asegúrate de que tu imagen tenga espacio libre donde una etiqueta extra no moleste, y que tu mensaje principal no dependa de texto justo en esa zona. En campañas de catálogo, estas etiquetas dinámicas (también llamadas info labels) sí suelen ser útiles para resaltar precios o envíos gratis sin trabajo extra de diseño, pero siempre evalúa si aportan claridad o si por el contrario distraen demasiado al espectador.
`;

export const PLACEMENTS: Placement[] = [
    // Facebook
    {
        id: PlacementId.FB_FEED,
        platform: 'Facebook',
        name: 'Feed (Noticias)',
        uiType: 'FEED',
        group: 'SQUARE_LIKE',
        aspectRatios: ['1:1', '4:5'],
        recommendedResolution: '1080x1080 / 1350 px',
        safeZone: { top: '9.3%', bottom: '9.3%', left: '9.3%', right: '9.3%' },
    },
    {
        id: PlacementId.FB_VIDEO_FEED,
        platform: 'Facebook',
        name: 'Video Feed',
        uiType: 'FEED',
        group: 'SQUARE_LIKE',
        aspectRatios: ['4:5', '1:1'],
        recommendedResolution: '1080x1350 px',
        safeZone: { top: '9.3%', bottom: '9.3%', left: '9.3%', right: '9.3%' },
    },
    {
        id: PlacementId.FB_STORIES,
        platform: 'Facebook',
        name: 'Stories',
        uiType: 'STORIES',
        group: 'VERTICAL',
        aspectRatios: ['9:16'],
        recommendedResolution: '1080x1920 px',
        safeZone: { top: '14%', bottom: '20%' },
    },
     {
        id: PlacementId.FB_REELS,
        platform: 'Facebook',
        name: 'Reels',
        uiType: 'REELS',
        group: 'VERTICAL',
        aspectRatios: ['9:16'],
        recommendedResolution: '1080x1920 px',
        safeZone: { top: '14%', bottom: '20%' },
    },
    {
        id: PlacementId.FB_MARKETPLACE,
        platform: 'Facebook',
        name: 'Marketplace',
        uiType: 'MARKETPLACE',
        group: 'SQUARE_LIKE',
        aspectRatios: ['1:1'],
        recommendedResolution: '1080x1080 px',
        safeZone: { top: '9.3%', bottom: '9.3%', left: '9.3%', right: '9.3%' },
    },
    // Instagram
    {
        id: PlacementId.IG_FEED,
        platform: 'Instagram',
        name: 'Feed',
        uiType: 'FEED',
        group: 'SQUARE_LIKE',
        aspectRatios: ['1:1', '4:5'],
        recommendedResolution: '1080x1080 / 1350 px',
        safeZone: { top: '9.3%', bottom: '9.3%', left: '9.3%', right: '9.3%' },
    },
    {
        id: PlacementId.IG_STORIES,
        platform: 'Instagram',
        name: 'Stories',
        uiType: 'STORIES',
        group: 'VERTICAL',
        aspectRatios: ['9:16'],
        recommendedResolution: '1080x1920 px',
        safeZone: { top: '14%', bottom: '20%' }, 
    },
    {
        id: PlacementId.IG_REELS,
        platform: 'Instagram',
        name: 'Reels',
        uiType: 'REELS',
        group: 'VERTICAL',
        aspectRatios: ['9:16'],
        recommendedResolution: '1080x1920 px',
        safeZone: { top: '14%', bottom: '20%' },
    },
    {
        id: PlacementId.IG_EXPLORE,
        platform: 'Instagram',
        name: 'Explore',
        uiType: 'FEED',
        group: 'SQUARE_LIKE',
        aspectRatios: ['1:1'],
        recommendedResolution: '1080x1080 px',
        safeZone: { top: '9.3%', bottom: '9.3%', left: '9.3%', right: '9.3%' },
    },
    // Messenger
    {
        id: PlacementId.MESSENGER_INBOX,
        platform: 'Messenger',
        name: 'Inbox',
        uiType: 'MESSENGER_INBOX',
        group: 'SQUARE_LIKE',
        aspectRatios: ['1.91:1'],
        recommendedResolution: '1200x628 px',
        safeZone: { top: '9.3%', bottom: '9.3%', left: '9.3%', right: '9.3%' },
    },
    {
        id: PlacementId.MESSENGER_STORIES,
        platform: 'Messenger',
        name: 'Stories',
        uiType: 'STORIES',
        group: 'VERTICAL',
        aspectRatios: ['9:16'],
        recommendedResolution: '1080x1920 px',
        safeZone: { top: '14%', bottom: '20%' },
    },
    // Audience Network
    {
        id: PlacementId.AUDIENCE_NETWORK,
        platform: 'Audience Network',
        name: 'Nativo/Intersticial',
        uiType: 'STORIES',
        group: 'VERTICAL',
        aspectRatios: ['9:16', '1:1', '1.91:1'],
        recommendedResolution: '1080x1920 px',
        safeZone: { top: '15%', bottom: '20%' }, 
    },
];