import os

# FIREBASE ADMIN SDK SECRETS
# Using a raw multi-line string for the private key to preserve PEM formatting.
FIREBASE_CONFIG = {
    "type": "service_account",
    "project_id": "mufyardv2",
    "private_key_id": "97130c2f7fb7dcc7bdb530bebea77c4894809ecb",
    "private_key": """-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGWi/u2fhbA47t
aMYgPenaTGMNQCVI4j2WoDaIAVyorK9y3gsXoYpV5UEj64mABGkJzUwGffhAdoXx
xJzDE8k1uAw6KiutZAHFCV1LQfkHhYYdK06IOYTogJfGQovIqKDKjHAVnK9TIO1B
IForDkP3Dm9jL4G6kIRbKDBCAXjlYUHZd6VJ5Hy5B2YkwQFYnvsD2BUMbAzo5kw0
GHXJQRwWXLtWl2e5pEDEzgtLwqXHxqw5huYNo6DCUJyva2Ea23ErNGc1dhi2PGIq
iTby0kWy3jcbdXjUKT+w8SQOZ/yPSTbnXQ6epJBSt9VT8oyTPwOQDUxymIgRdN53
hr4ugc9TAgMBAAECggEACOA8SN9EIn5+74IYFj/vA6/AtvUUi2BkX9B84DUqD6Tl
QlShVnC0ygc06ls95JajRKcFLJKH1gqiZSE73+w2EstQ8MFhAaSkrPaFpY/RialL
SRQzssYwJl9Va1p1pYhg5ETIjI8IYXCVwquknUyeyfgWupouSfTxl0qtw3u2tzzr
aHrloBtP0KGS7bhzy99hcEHQUxra4+bmlTlEWYR14ghOsJhUuIdyUTRVekuQtFI8
SaPTycVhp0jBjbQH0n/gvMPibHdkyHm6ECzjkmkySrnfn28c3D2DNJMm8hwy2kIJ
cnseaTUWq6SefUuOBuf9IAOq6DtMWqpBjGPVNh5UsQKBgQDmrgHo+X/i5bqDkpbQ
ryKNWkI94h7BXgPnYrcgUpCeHEPMZLnIxzI891ZS23hKSqmKfk9saXDb2hTMgyBm
NTdvdjaOSnLFKoDcDBXsOzL65EKH8uJ7dfrF8lkdgvPZmzInyqtH5Y3zZJO8XFsQ
bi7fj6kXMT/V8DUmE7c7tlUNxwKBgQDcH8tU0FcbQZM5HEHq6oDpTOM/T/ewy0Qt
Z8TxW52/WFtUPeVN3U5TW0pTtM+2G7rJhLxxS99eIoJjin0gno1vdwSNaI4+yBgu
fFosdXISTnK+HeshJ/grduyu2dvfWWNg450n0nJlso2X9MtlWauEx5UC7OM1A4Qj
lkLx+bLiFQKBgAxFKTjZPKI3Egq5m2gSSMY4DNn50yT5+T8vkwoXGjYuzrRqjy9M
2TFA/sh9gBKDki0ZtuPPX/9xxDV0rB6DqiU1poU/FIfEUQJjai8cnwOVbKyKkN18
UxCAaZkWRB5JEQvozd+PKFPP/8O/LeDb24Zsv9PJ/NlGY61Y0yBL/I41AoGBAMAr
SZmroL/8yYhsMOfi/dOu+h0FtRk0+zogg4CqGNc5TdIHjy4g7AY9hm/5Q/SZ1MGl
DdZjBIfr3KUF/CMECDmtT94bz0Lj8Kh0i0yQ45szvVxYRjNV74QSeKJVM2yTXvzw
+PwQ7yn1bUOhxAeg9uoeSuqY3+oiPbPLtHoHIbHZAoGAdMzJT7nfbu8adggqipjc
fQ2mw27TR6XroLUU08sbGK9S422NA3RQALJWdWfdASutOkSDAGJMUwz7WJhc1ir4
fAxUnsQxbH9d6qN3VdUM9DIjsuzxLlMEJRnXLxGDVGHDb2Rb9Wwtit4QoZ1s/3OK
VESm2lguT7AU7K+f6oWDmpg=
-----END PRIVATE KEY-----""",
    "client_email": "firebase-adminsdk-fbsvc@mufyardv2.iam.gserviceaccount.com",
    "client_id": "111955449195284035462",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40mufyardv2.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
}
