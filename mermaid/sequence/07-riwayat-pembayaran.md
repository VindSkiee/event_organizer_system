```mermaid
sequenceDiagram
    participant UI_Client
    participant Controller_or_Router
    participant Service_or_Logic
    participant Database

    UI_Client->>Controller_or_Router: GET /payments/history
    activate Controller_or_Router
    Controller_or_Router->>Service_or_Logic: getPaymentHistory(userId)
    activate Service_or_Logic
    Service_or_Logic->>Database: fetchUserPayments(userId)
    activate Database
    Database-->>Service_or_Logic: payments | empty | error
    deactivate Database

    alt Gagal mengambil riwayat pembayaran
        Service_or_Logic-->>Controller_or_Router: error DataFetchFailed
        Controller_or_Router-->>UI_Client: 500 gagal memuat riwayat
    else Data pembayaran tersedia
        Service_or_Logic-->>Controller_or_Router: paymentList
        Controller_or_Router-->>UI_Client: Render riwayat pembayaran
    else Belum ada pembayaran
        Service_or_Logic-->>Controller_or_Router: emptyList
        Controller_or_Router-->>UI_Client: Render daftar kosong
    end

    deactivate Service_or_Logic
    deactivate Controller_or_Router
```
