# Starting the site

**You cannot open `client/index.html` by double-clicking it.** That file
asks the browser for `/src/main.js`, which only exists while a server is
running — hence the `404 (Not Found) main.js`. This is a Vue application
now, not a folder of plain HTML pages.

Here is what to do instead.

---

## Once, the first time

You need **Node.js 18 or newer** and **MySQL 8** (or MariaDB 10.5+).

**1. Create the database**

```bash
mysql -u root -p < server/sql/schema.sql
```

**2. Create a user for it** (do not run the site as `root`):

```sql
CREATE USER 'newsletter'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON my_newsletter.* TO 'newsletter'@'localhost';
FLUSH PRIVILEGES;
```

**3. Set up the project**

```bash
cp server/.env.example server/.env     # then put your password in it
npm run setup
npm run seed                           # optional: demo data
```

---

## Every time after that

```bash
npm start
```

That builds the site and serves everything from **one** address:
**http://localhost:3000**

---

## While you are changing the design

`npm start` has to rebuild each time. While you are editing, use two
terminals instead, and the page refreshes on its own as you save:

```bash
# terminal 1
npm run server      # the API, on port 3000

# terminal 2
npm run client      # the site, on port 5173  ← open this one
```

Open **http://localhost:5173**.

---

## Demo accounts

After `npm run seed`, the password is **`password123`** for everyone:

| Address | What it shows off |
|---|---|
| `aurelia@mynewsletter.app` | **The admin area**, full bundle, so no ads |
| `lea@mynewsletter.app` | An ordinary member, "no ads" only |
| `mina@mynewsletter.app` | Two add-ons, one paper order |
| `zoe@mynewsletter.app` | No subscription: **she is the one who sees the ads** |

---

## If something goes wrong

| What you see | What it means |
|---|---|
| `404 … main.js` | You opened the HTML file directly. Use `npm start`. |
| "The API is running, the site is not built" | Run `npm run build`, or use `npm run client`. |
| `ECONNREFUSED … 3306` | MySQL is not running. |
| `Access denied for user` | The password in `server/.env` does not match the one you set in MySQL. |
| `Unknown database 'my_newsletter'` | Step 1 above has not been run. |
