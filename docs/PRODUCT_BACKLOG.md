# SANA — Product Backlog (başlangıç)

> Product Owner bu listeyi yönetir; her sprint başında üstten User Story seçilip Sprint Backlog'a alınır.
> Tahmin: Story Points (SP) — Fibonacci (1,2,3,5,8).

## Epic 1 — Temel & Kimlik (Sprint 1)
| # | User Story | SP | Sprint |
|---|---|---|---|
| 1.1 | Kullanıcı olarak kayıt olup giriş yapabilmeliyim. | 3 | 1 |
| 1.2 | Profil (kullanıcı adı, şehir, bio) oluşturabilmeliyim. | 2 | 1 |
| 1.3 | Onboarding sorularına yanıt verebilmeliyim (tercihlerim kaydedilsin). | 3 | 1 |

## Epic 2 — Harita & Keşif (Sprint 1)
| # | User Story | SP | Sprint |
|---|---|---|---|
| 2.1 | Haritada (seed) rotaları polyline + marker olarak görebilmeliyim. | 5 | 1 |
| 2.2 | Bir rotaya tıklayıp flood/story detayını sıralı gezebilmeliyim. | 5 | 1 |
| 2.3 | Rota detayında her durağın fotoğrafını ve kişisel notunu görebilmeliyim. | 3 | 1 |

## Epic 3 — AI Pipeline & Hafıza (Sprint 2)
| # | User Story | SP | Sprint |
|---|---|---|---|
| 3.1 | Doğal dilde ("yalnızım, kafa dinlemek istiyorum, bütçem az") niyet yazabilmeliyim. | 3 | 2 |
| 3.2 | Sistem niyetime uygun gerçek kullanıcı rotalarını hafızadan (pgvector) getirsin. | 8 | 2 |
| 3.3 | Sonuç bütçeme (price_level) ve havaya göre süzülsün. | 5 | 2 |
| 3.4 | Önerilen rota en az yürüyüşle sıralanıp haritada gösterilsin. | 5 | 2 |
| 3.5 | Telefonu elimde rotayı canlı takip edebilmeliyim ("buradasın" + sonraki durak mesafesi). | 5 | 2 |

## Epic 4 — Sosyal Katman & Proof of Experience (Sprint 3)
| # | User Story | SP | Sprint |
|---|---|---|---|
| 4.1 | Haritada durak seçerek (uzun bas/ara) kendi rotamı oluşturup not+foto ekleyip kaydedebilmeliyim. | 8 | 3 |
| 4.2 | Bir rotanın altına kendi fotoğrafımı/yorumumu ekleyebilmeliyim (proof of experience). | 5 | 3 |
| 4.3 | Başkasının rotasını favorileyip "Kaydettiklerim" listemde toplayabilmeliyim. | 3 | 3 |
| 4.4 | Bana benzer/yakındaki kullanıcılara dair bir sosyal sinyal görebilmeliyim (simüle). | 3 | 3 |

> **Sosyal döngü (4.1 kritik detay):** Kullanıcı kendi rotasını kaydettiğinde rota metni NVIDIA ile embedlenip `ai_memory_embeddings`'e eklenir → o rota **başkalarının AI aramasında** çıkar. Mevcut `backfill.py`'daki embed mantığı bu akışta yeniden kullanılır.

## Epic 5 — Canlıya Alma & Teslim (Sprint 3)
| # | User Story | SP | Sprint |
|---|---|---|---|
| 5.1 | Ürün EAS APK / Expo link olarak test edilebilir olmalı. | 3 | 3 |
| 5.2 | 3 dakikalık tanıtım videosu (altın senaryo) hazır olmalı. | 3 | 3 |

---
**Notlar:** Tahminler ekip Planning Poker ile gözden geçirilmeli. "Definition of Done":
çalışan kod + merge edilmiş PR + ilgili sprint demosunda gösterilebilir + README güncel.
