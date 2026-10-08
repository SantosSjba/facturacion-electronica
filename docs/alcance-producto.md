# Alcance del producto

Factosys vende acceso a una API de facturación electrónica. La primera etapa contiene:

- **API** (`apps/api`): emisión, estados, XML/CDR/PDF, validaciones y webhooks.
- **Landing** (`apps/landing`): información comercial, planes, solicitud de acceso y documentación de la API.
- **Panel del dueño** (`apps/saas-web`, `/platform`): solicitudes, clientes, planes, auditoría y administración del servicio.
- **Panel del cliente** (`apps/saas-web`, `/app`): onboarding, empresas, certificados, credenciales SUNAT, series, API keys, webhooks, usuarios, consumo y plan.

La emisión se realiza mediante la API. Los paneles no incluyen formularios de emisión manual, facturador, punto de venta, productos, inventario ni caja. Un facturador u otras aplicaciones consumidoras se evaluarán cuando la API esté madura.

La configuración de empresas y acceso a la API pertenece al panel cliente. El motor UBL, firma, transporte SUNAT y generación de PDF pertenecen a la API y se mantienen en esta etapa.

Los modos Fake/beta y las funciones pendientes deben identificarse como tales. Este alcance no certifica preparación para producción ni conformidad tributaria.
