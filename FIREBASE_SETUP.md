# SafeTag — configuration Firebase Auth + multi-utilisateurs

## 1. Activer Firebase Authentication

Dans Firebase Console :

1. **Build → Authentication**
2. **Get started**
3. **Sign-in method**
4. Activer **Email/Password**

Le site utilise ensuite Firebase Authentication pour créer les sessions.

## 2. Installer les règles Realtime Database

Copier le contenu de `database.rules.json` dans :

**Firebase → Realtime Database → Rules**

puis publier.

> Important : la règle `position.write = true` est volontairement ouverte pour que le Wemos actuel puisse continuer à écrire sans compte Firebase. C'est acceptable pour le prototype scolaire, mais ce n'est pas la version finale de sécurité. La prochaine étape sera de donner une identité Firebase propre à chaque appareil.

## 3. Structure de données utilisée

```
profiles/{uid}
directory/{emailKey}

userDevices/{uid}/{deviceId}

devices/{deviceId}/meta
devices/{deviceId}/members/{uid}
devices/{deviceId}/position
```

Rôles :

- `owner` : propriétaire, non retirable depuis l'interface
- `admin` : peut ajouter/retirer des membres et changer leurs rôles
- `viewer` : peut consulter le tracker

## 4. Premier appareil

Le prototype utilise l'identifiant :

```
ST-0001
```

Le premier utilisateur connecté peut cliquer sur **Associer le prototype ST-0001** si aucun propriétaire n'existe encore.

## 5. Compatibilité avec le Wemos actuel

Le dashboard essaie d'abord de lire :

```
devices/ST-0001/position
```

Si cette donnée n'existe pas encore, il lit temporairement l'ancien chemin :

```
safetag/position
```

Cela permet de migrer le code du Wemos plus tard sans casser le site immédiatement.

## 6. Prochaine étape Wemos

Modifier ensuite le Wemos pour écrire dans :

```
devices/ST-0001/position
```

et ajouter un champ `lastUpdate` en millisecondes Unix. Le site utilise déjà ce champ s'il est présent pour afficher automatiquement **connecté / hors ligne** tout en conservant la dernière position sur la carte.
