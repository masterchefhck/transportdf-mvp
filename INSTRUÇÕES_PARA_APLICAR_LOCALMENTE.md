# Instruções para Aplicar as Mudanças do Google Maps Localmente

## Situação Atual
Você está vendo a interface antiga porque as mudanças do Google Maps estão no ambiente Docker (container), mas você está executando o Expo no seu ambiente local Windows (192.168.1.208).

## Arquivos que Você Precisa Atualizar no Seu Computador Local

### 1. Criar o arquivo GoogleMapView.tsx
**Localização:** `C:\transportdf-mvp\frontend\components\GoogleMapView.tsx`

**Ação:** Criar um novo arquivo com o conteúdo que está em `/app/frontend/components/GoogleMapView.tsx` (arquivo que criei)

### 2. Atualizar passenger/dashboard.tsx
**Localização:** `C:\transportdf-mvp\frontend\app\passenger\dashboard.tsx`

**Principais mudanças necessárias:**

#### 2.1. Adicionar import do GoogleMapView:
```typescript
import GoogleMapView from '../../components/GoogleMapView';
```

#### 2.2. Adicionar estado para o Google Maps Modal:
```typescript
// Google Map states
const [showGoogleMapModal, setShowGoogleMapModal] = useState(false);
```

#### 2.3. Adicionar função para lidar com solicitação via Google Maps:
```typescript
// Handle Google Maps trip request
const handleGoogleMapTripRequest = async (tripData: {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  originAddress: string;
  destinationAddress: string;
  estimatedPrice: number;
  distance: string;
  duration: string;
}) => {
  setLoading(true);
  try {
    const token = await AsyncStorage.getItem('access_token');
    const response = await axios.post(
      `${API_URL}/api/trips/request`,
      {
        passenger_id: user?.id,
        pickup_latitude: tripData.origin.latitude,
        pickup_longitude: tripData.origin.longitude,
        pickup_address: tripData.originAddress,
        destination_latitude: tripData.destination.latitude,
        destination_longitude: tripData.destination.longitude,
        destination_address: tripData.destinationAddress,
        estimated_price: tripData.estimatedPrice,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (response.data) {
      setCurrentTrip(response.data);
      setShowGoogleMapModal(false);
      showAlert(
        'Sucesso', 
        `Corrida solicitada!\nPreço estimado: R$ ${tripData.estimatedPrice.toFixed(2)}\nDistância: ${tripData.distance} • Tempo: ${tripData.duration}`
      );
    }
  } catch (error: any) {
    console.error('Erro ao solicitar corrida:', error);
    const errorMessage = error.response?.data?.detail || 'Erro ao solicitar corrida';
    showAlert('Erro', errorMessage);
  } finally {
    setLoading(false);
  }
};
```

#### 2.4. Alterar o botão "Solicitar Viagem":
**Encontrar:**
```typescript
onPress={() => setShowRequestModal(true)}
```

**Trocar por:**
```typescript
onPress={() => setShowGoogleMapModal(true)}
```

#### 2.5. Adicionar o modal do Google Maps antes do "Photo Viewer Modal":
```typescript
{/* Google Map Modal */}
<Modal 
  visible={showGoogleMapModal} 
  animationType="slide" 
  presentationStyle="pageSheet"
>
  <GoogleMapView
    onTripRequest={handleGoogleMapTripRequest}
    onClose={() => setShowGoogleMapModal(false)}
  />
</Modal>
```

### 3. Configurar as Variáveis de Ambiente
**Localização:** `C:\transportdf-mvp\frontend\.env`

**Adicionar:** (se ainda não tiver)
```
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=SUA_CHAVE_AQUI
```

### 4. Configurar app.json
**Localização:** `C:\transportdf-mvp\frontend\app.json`

**Adicionar nas configurações:**
```json
{
  "expo": {
    "ios": {
      "config": {
        "googleMapsApiKey": "SUA_CHAVE_AQUI"
      }
    },
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "SUA_CHAVE_AQUI"
        }
      }
    }
  }
}
```

### 5. Instalar Dependências (se necessário)
No terminal dentro de `C:\transportdf-mvp\frontend\`:
```bash
npm install react-native-maps expo-location react-native-google-places-autocomplete
```

## Resultado Esperado
Após aplicar essas mudanças:
1. Parar o Expo (Ctrl+C)
2. Reiniciar com `expo start`
3. Quando clicar em "Solicitar Viagem" deve aparecer uma tela com mapa interativo tipo Uber/99
4. Deve mostrar sua localização atual e permitir buscar destinos
5. Deve calcular rotas e preços automaticamente

## Observações
- A chave do Google Maps deve estar configurada corretamente
- O componente só funciona com a chave real (não com mock)
- Se não tiver a chave, o componente mostrará uma mensagem de erro orientando a configuração