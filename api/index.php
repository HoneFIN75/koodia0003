<?php

declare(strict_types=1);

const STORAGE_FILES = [
    'snapshot' => 'state.json',
    'players' => 'players.json',
    'tournaments' => 'tournaments.json',
    'resultCards' => 'resultCards.json',
    'tournamentResults' => 'tournamentResults.json',
    'scoreTables' => 'scoreTables.json',
    'multipliers' => 'multipliers.json',
    'settings' => 'settings.json',
];

const SITE_AUTH_SETTING_KEYS = [
    'sitePassword',
    'sitePasswordHash',
    'authSecret',
];

const DEFAULT_SITE_PASSWORD = 'sfl-pisteet-2026';
const SITE_PASSWORD_MIN_LENGTH = 8;
const SITE_PASSWORD_MAX_LENGTH = 200;
const AUTH_TOKEN_HEADER = 'HTTP_X_SFL_AUTH_TOKEN';

final class AuthRequiredException extends RuntimeException
{
}

const REQUIRED_BASE_STATE_KEYS = [
    'players',
    'tournaments',
    'settings',
    'pointsTable',
    'multipliers',
];

function send_json(int $statusCode, array $payload, array $extraHeaders = []): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');

    foreach ($extraHeaders as $name => $value) {
        header(sprintf('%s: %s', $name, $value));
    }

    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n";
}

function create_default_state(): array
{
    return [
        'version' => 3,
        'players' => [],
        'tournaments' => [],
        'resultCards' => [],
        'settings' => [
            'pdgaPlayerBaseUrl' => 'https://www.pdga.com/player/',
            'pdgaEventBaseUrl' => 'https://www.pdga.com/tour/event/',
        ],
        'pointsTable' => [
            'MPO' => new stdClass(),
            'FPO' => new stdClass(),
        ],
        'multipliers' => [
            [
                'id' => 'multiplier-major',
                'orderNumber' => 1,
                'name' => 'Major',
                'abbreviation' => 'MAJ',
                'multiplier' => 2,
                'createdAt' => '',
                'updatedAt' => '',
            ],
            [
                'id' => 'multiplier-national-tour',
                'orderNumber' => 2,
                'name' => 'National Tour',
                'abbreviation' => 'NT',
                'multiplier' => 1.5,
                'createdAt' => '',
                'updatedAt' => '',
            ],
            [
                'id' => 'multiplier-c-tier',
                'orderNumber' => 3,
                'name' => 'C-Tier',
                'abbreviation' => 'CT',
                'multiplier' => 1,
                'createdAt' => '',
                'updatedAt' => '',
            ],
        ],
    ];
}

function jsondb_directory_path(): string
{
    $configuredPath = trim((string) getenv('SFL_JSONDB_PATH'));
    if ($configuredPath !== '') {
        $documentRoot = rtrim(str_replace('\\', '/', (string) ($_SERVER['DOCUMENT_ROOT'] ?? '')), '/');
        $normalizedConfigured = rtrim(str_replace('\\', '/', $configuredPath), '/');
        $allowPublicPath = strtolower(trim((string) getenv('SFL_ALLOW_PUBLIC_JSONDB'))) === 'true';

        if (
            !$allowPublicPath
            && $documentRoot !== ''
            && (
                $normalizedConfigured === $documentRoot
                || str_starts_with($normalizedConfigured . '/', $documentRoot . '/')
            )
        ) {
            throw new RuntimeException('UNSAFE_JSONDB_PATH');
        }

        return $configuredPath;
    }

    return dirname(__DIR__) . DIRECTORY_SEPARATOR . 'jsondb';
}

function jsondb_file_path(string $fileName): string
{
    return jsondb_directory_path() . DIRECTORY_SEPARATOR . $fileName;
}

function write_json_atomically(string $filePath, $value): void
{
    $encodedValue = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($encodedValue === false) {
        throw new RuntimeException('FAILED_TO_ENCODE_JSON');
    }

    $directoryPath = dirname($filePath);
    $tempFilePath = $directoryPath . DIRECTORY_SEPARATOR . sprintf(
        '.tmp-%s-%s-%s',
        getmypid(),
        bin2hex(random_bytes(6)),
        basename($filePath)
    );

    $payload = $encodedValue . "\n";
    if (file_put_contents($tempFilePath, $payload, LOCK_EX) === false) {
        throw new RuntimeException('FAILED_TO_WRITE_FILE');
    }

    if (!rename($tempFilePath, $filePath)) {
        @unlink($tempFilePath);
        throw new RuntimeException('FAILED_TO_RENAME_FILE');
    }
}

function write_json_atomically_if_changed(string $filePath, $value): void
{
    $encodedValue = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($encodedValue === false) {
        throw new RuntimeException('FAILED_TO_ENCODE_JSON');
    }

    $payload = $encodedValue . "\n";
    if (is_file($filePath)) {
        $existing = file_get_contents($filePath);
        if ($existing === false) {
            throw new RuntimeException('FAILED_TO_READ_FILE');
        }

        if ($existing === $payload) {
            return;
        }
    }

    write_json_atomically($filePath, $value);
}

function read_json_file(string $filePath, $fallback)
{
    if (!is_file($filePath)) {
        return $fallback;
    }

    $contents = file_get_contents($filePath);
    if ($contents === false) {
        throw new RuntimeException('FAILED_TO_READ_FILE');
    }

    try {
        return json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        throw new RuntimeException('INVALID_JSON_FILE', 0, $exception);
    }
}

function read_json_file_if_exists(string $filePath)
{
    if (!is_file($filePath)) {
        return null;
    }

    $contents = file_get_contents($filePath);
    if ($contents === false) {
        throw new RuntimeException('FAILED_TO_READ_FILE');
    }

    try {
        return json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        throw new RuntimeException('INVALID_JSON_FILE', 0, $exception);
    }
}

function ensure_jsondb_directory(): void
{
    $directoryPath = jsondb_directory_path();
    if (!is_dir($directoryPath) && !mkdir($directoryPath, 0775, true) && !is_dir($directoryPath)) {
        throw new RuntimeException('FAILED_TO_CREATE_DIRECTORY');
    }

    $denyAccessHtaccess = $directoryPath . DIRECTORY_SEPARATOR . '.htaccess';
    $denyAccessRules = "Deny from all\n<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n";
    $currentRules = is_file($denyAccessHtaccess) ? file_get_contents($denyAccessHtaccess) : false;
    if ($currentRules === false || $currentRules !== $denyAccessRules) {
        if (file_put_contents($denyAccessHtaccess, $denyAccessRules, LOCK_EX) === false) {
            throw new RuntimeException('FAILED_TO_WRITE_HTACCESS');
        }
    }

    if (!is_file($denyAccessHtaccess)) {
        throw new RuntimeException('FAILED_TO_WRITE_HTACCESS');
    }
}

function normalize_state_payload(array $payload): array
{
    $defaultState = create_default_state();

    if (!array_key_exists('pointsTable', $payload) && array_key_exists('scoreTables', $payload)) {
        $payload['pointsTable'] = $payload['scoreTables'];
    }

    foreach (REQUIRED_BASE_STATE_KEYS as $requiredKey) {
        if (!array_key_exists($requiredKey, $payload)) {
            throw new InvalidArgumentException('INCOMPLETE_STATE_PAYLOAD');
        }
    }

    if (!array_key_exists('resultCards', $payload)) {
        if (array_key_exists('tournamentResults', $payload)) {
            $payload['resultCards'] = $payload['tournamentResults'];
        } else {
            throw new InvalidArgumentException('INCOMPLETE_STATE_PAYLOAD');
        }
    }

    if (!is_array($payload['resultCards']) || !array_is_list($payload['resultCards'])) {
        throw new InvalidArgumentException('INVALID_STATE_PAYLOAD');
    }

    $payload['settings'] = strip_site_auth_settings(
        is_array($payload['settings'])
            ? array_replace($defaultState['settings'], $payload['settings'])
            : $defaultState['settings']
    );

    $payloadPointsTable = is_array($payload['pointsTable']) ? $payload['pointsTable'] : [];
    $payload['pointsTable'] = [
        'MPO' => is_array($payloadPointsTable['MPO'] ?? null) ? $payloadPointsTable['MPO'] : [],
        'FPO' => is_array($payloadPointsTable['FPO'] ?? null) ? $payloadPointsTable['FPO'] : [],
    ];

    return $payload;
}

function sync_state_slices(array $state): void
{
    write_json_atomically_if_changed(jsondb_file_path(STORAGE_FILES['players']), $state['players'] ?? []);
    write_json_atomically_if_changed(jsondb_file_path(STORAGE_FILES['tournaments']), $state['tournaments'] ?? []);

    $resultCards = $state['resultCards'] ?? $state['tournamentResults'] ?? [];
    write_json_atomically_if_changed(jsondb_file_path(STORAGE_FILES['resultCards']), $resultCards);
    write_json_atomically_if_changed(jsondb_file_path(STORAGE_FILES['tournamentResults']), $resultCards);

    write_json_atomically_if_changed(
        jsondb_file_path(STORAGE_FILES['scoreTables']),
        $state['pointsTable'] ?? ['MPO' => new stdClass(), 'FPO' => new stdClass()]
    );
    write_json_atomically_if_changed(jsondb_file_path(STORAGE_FILES['multipliers']), $state['multipliers'] ?? []);
    $settings = is_array($state['settings'] ?? null) ? strip_site_auth_settings($state['settings']) : [];
    with_settings_lock(static function () use ($settings): void {
        write_json_atomically_if_changed(
            jsondb_file_path(STORAGE_FILES['settings']),
            array_replace($settings, read_site_auth_config())
        );
    });
}

function with_settings_lock(callable $callback)
{
    static $depth = 0;

    if ($depth > 0) {
        return $callback();
    }

    $lockHandle = fopen(jsondb_file_path('.settings.lock'), 'c');
    if ($lockHandle === false || !flock($lockHandle, LOCK_EX)) {
        throw new RuntimeException('FAILED_TO_LOCK_SETTINGS');
    }

    $depth++;
    try {
        return $callback();
    } finally {
        $depth--;
        flock($lockHandle, LOCK_UN);
        fclose($lockHandle);
    }
}

function strip_site_auth_settings(array $settings): array
{
    foreach (SITE_AUTH_SETTING_KEYS as $authKey) {
        unset($settings[$authKey]);
    }

    return $settings;
}

function read_settings_file(): array
{
    $settings = read_json_file(jsondb_file_path(STORAGE_FILES['settings']), []);
    return is_array($settings) && !array_is_list($settings) ? $settings : [];
}

function read_site_auth_config(): array
{
    $settings = read_settings_file();
    $authConfig = [];
    foreach (SITE_AUTH_SETTING_KEYS as $authKey) {
        if (isset($settings[$authKey]) && is_string($settings[$authKey]) && $settings[$authKey] !== '') {
            $authConfig[$authKey] = $settings[$authKey];
        }
    }

    return $authConfig;
}

function write_site_auth_config(array $authConfig): void
{
    $settings = array_replace(strip_site_auth_settings(read_settings_file()), $authConfig);
    write_json_atomically(jsondb_file_path(STORAGE_FILES['settings']), $settings);
}

function ensure_site_auth_config(): array
{
    ensure_jsondb_directory();
    return with_settings_lock('ensure_site_auth_config_locked');
}

function ensure_site_auth_config_locked(): array
{
    $authConfig = read_site_auth_config();
    $changed = false;

    if (!isset($authConfig['authSecret'])) {
        $authConfig['authSecret'] = bin2hex(random_bytes(32));
        $changed = true;
    }

    if (!isset($authConfig['sitePasswordHash']) && !isset($authConfig['sitePassword'])) {
        $authConfig['sitePasswordHash'] = password_hash(DEFAULT_SITE_PASSWORD, PASSWORD_DEFAULT);
        $changed = true;
    }

    if ($changed) {
        write_site_auth_config($authConfig);
    }

    return $authConfig;
}

function verify_site_password(string $password): bool
{
    ensure_jsondb_directory();
    return with_settings_lock(static fn (): bool => verify_site_password_locked($password));
}

function verify_site_password_locked(string $password): bool
{
    $authConfig = ensure_site_auth_config_locked();

    if (isset($authConfig['sitePasswordHash'])) {
        return password_verify($password, $authConfig['sitePasswordHash']);
    }

    if (!hash_equals($authConfig['sitePassword'], $password)) {
        return false;
    }

    unset($authConfig['sitePassword']);
    $authConfig['sitePasswordHash'] = password_hash($password, PASSWORD_DEFAULT);
    write_site_auth_config($authConfig);

    return true;
}

function create_auth_token(): string
{
    $authConfig = ensure_site_auth_config();
    $nonce = bin2hex(random_bytes(16));

    return $nonce . '.' . hash_hmac('sha256', $nonce, $authConfig['authSecret']);
}

function is_valid_auth_token(string $token): bool
{
    if (!preg_match('/^([a-f0-9]{32})\.([a-f0-9]{64})$/', $token, $matches)) {
        return false;
    }

    $authConfig = ensure_site_auth_config();
    return hash_equals(hash_hmac('sha256', $matches[1], $authConfig['authSecret']), $matches[2]);
}

function require_authenticated_request(): void
{
    $token = trim((string) ($_SERVER[AUTH_TOKEN_HEADER] ?? ''));
    if ($token === '' || !is_valid_auth_token($token)) {
        throw new AuthRequiredException('AUTH_REQUIRED');
    }
}

function read_password_from_request(): string
{
    $payload = read_request_json_payload();
    $password = $payload['password'] ?? '';

    return is_string($password) ? $password : '';
}

function load_state(): array
{
    ensure_jsondb_directory();
    $stateFromSlices = create_default_state();
    $stateFromSlices['players'] = read_json_file(jsondb_file_path(STORAGE_FILES['players']), $stateFromSlices['players']);
    $stateFromSlices['tournaments'] = read_json_file(
        jsondb_file_path(STORAGE_FILES['tournaments']),
        $stateFromSlices['tournaments']
    );
    $stateFromSlices['settings'] = read_json_file(jsondb_file_path(STORAGE_FILES['settings']), $stateFromSlices['settings']);
    $stateFromSlices['multipliers'] = read_json_file(
        jsondb_file_path(STORAGE_FILES['multipliers']),
        $stateFromSlices['multipliers']
    );
    $stateFromSlices['pointsTable'] = read_json_file(
        jsondb_file_path(STORAGE_FILES['scoreTables']),
        $stateFromSlices['pointsTable']
    );

    $resultCards = read_json_file_if_exists(jsondb_file_path(STORAGE_FILES['resultCards']));
    if (!is_array($resultCards) || !array_is_list($resultCards)) {
        $resultCards = read_json_file(jsondb_file_path(STORAGE_FILES['tournamentResults']), $stateFromSlices['resultCards']);
        if (!is_array($resultCards) || !array_is_list($resultCards)) {
            $resultCards = $stateFromSlices['resultCards'];
        }
    }
    $stateFromSlices['resultCards'] = $resultCards;

    $snapshot = read_json_file_if_exists(jsondb_file_path(STORAGE_FILES['snapshot']));
    if (!is_array($snapshot) || array_is_list($snapshot)) {
        $snapshot = [];
    }

    $state = normalize_state_payload(array_replace($stateFromSlices, $snapshot));
    write_json_atomically_if_changed(jsondb_file_path(STORAGE_FILES['snapshot']), $state);
    sync_state_slices($state);

    return $state;
}

function save_state(array $state): array
{
    ensure_jsondb_directory();
    $normalizedState = normalize_state_payload($state);

    write_json_atomically(jsondb_file_path(STORAGE_FILES['snapshot']), $normalizedState);
    sync_state_slices($normalizedState);

    return $normalizedState;
}

function read_request_json_payload(): array
{
    $rawBody = (string) file_get_contents('php://input');
    if (trim($rawBody) === '') {
        return [];
    }

    try {
        $decodedBody = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        throw new InvalidArgumentException('INVALID_JSON');
    }

    if (!is_array($decodedBody) || array_is_list($decodedBody)) {
        throw new InvalidArgumentException('INVALID_STATE_PAYLOAD');
    }

    return $decodedBody;
}

function handle_health_endpoint(string $method): void
{
    if ($method !== 'GET') {
        send_json(405, ['message' => 'Metodia ei tueta.'], ['Allow' => 'GET']);
        return;
    }

    send_json(200, ['status' => 'ok']);
}

function handle_login_endpoint(string $method): void
{
    if ($method !== 'POST') {
        send_json(405, ['message' => 'Metodia ei tueta.'], ['Allow' => 'POST']);
        return;
    }

    $password = read_password_from_request();
    if ($password === '' || !verify_site_password($password)) {
        usleep(500000);
        send_json(401, ['message' => 'Väärä salasana. Yritä uudelleen.']);
        return;
    }

    send_json(200, ['token' => create_auth_token()]);
}

function handle_site_password_endpoint(string $method): void
{
    if ($method !== 'PUT') {
        send_json(405, ['message' => 'Metodia ei tueta.'], ['Allow' => 'PUT']);
        return;
    }

    require_authenticated_request();
    $password = read_password_from_request();
    $passwordLength = preg_match_all('/./su', $password);
    if ($passwordLength === false || trim($password) === '' || $passwordLength < SITE_PASSWORD_MIN_LENGTH || $passwordLength > SITE_PASSWORD_MAX_LENGTH) {
        send_json(400, [
            'message' => sprintf(
                'Salasanan pituuden pitää olla %d–%d merkkiä.',
                SITE_PASSWORD_MIN_LENGTH,
                SITE_PASSWORD_MAX_LENGTH
            ),
        ]);
        return;
    }

    with_settings_lock(static function () use ($password): void {
        $authConfig = ensure_site_auth_config_locked();
        unset($authConfig['sitePassword']);
        $authConfig['sitePasswordHash'] = password_hash($password, PASSWORD_DEFAULT);
        write_site_auth_config($authConfig);
    });

    send_json(200, ['message' => 'Sivuston salasana tallennettiin.']);
}

function handle_state_endpoint(string $method): void
{
    if ($method === 'GET' || $method === 'PUT') {
        require_authenticated_request();
    }

    if ($method === 'GET') {
        send_json(200, load_state());
        return;
    }

    if ($method === 'PUT') {
        send_json(200, save_state(read_request_json_payload()));
        return;
    }

    send_json(405, ['message' => 'Metodia ei tueta.'], ['Allow' => 'GET, PUT']);
}

try {
    $endpoint = strtolower(trim((string) ($_GET['endpoint'] ?? ''), '/'));
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

    if ($endpoint === 'health') {
        handle_health_endpoint($method);
        return;
    }

    if ($endpoint === 'login') {
        handle_login_endpoint($method);
        return;
    }

    if ($endpoint === 'site-password') {
        handle_site_password_endpoint($method);
        return;
    }

    if ($endpoint === 'state') {
        handle_state_endpoint($method);
        return;
    }

    send_json(404, ['message' => 'Rajapintaa ei löytynyt.']);
} catch (AuthRequiredException $error) {
    send_json(401, ['message' => 'Kirjautuminen vaaditaan. Kirjaudu sisään uudelleen.']);
} catch (InvalidArgumentException $error) {
    if ($error->getMessage() === 'INVALID_JSON') {
        send_json(400, ['message' => 'Pyynnön JSON-data on virheellinen.']);
        return;
    }

    if ($error->getMessage() === 'INCOMPLETE_STATE_PAYLOAD') {
        send_json(400, ['message' => 'Tallennettava tila on puutteellinen. Lähetä koko sovelluksen tila yhdessä pyynnössä.']);
        return;
    }

    if ($error->getMessage() === 'INVALID_STATE_PAYLOAD') {
        send_json(400, ['message' => 'Tallennettava tila pitää lähettää JSON-objektina.']);
        return;
    }

    send_json(400, ['message' => 'Tallennettava tila on puutteellinen. Lähetä koko sovelluksen tila yhdessä pyynnössä.']);
} catch (Throwable $error) {
    if ($error->getMessage() === 'UNSAFE_JSONDB_PATH') {
        send_json(500, ['message' => 'Palvelimen tallennushakemistoa ei ole määritetty turvallisesti.']);
        return;
    }

    send_json(500, ['message' => 'Palvelimella tapahtui virhe tallennuksen aikana.']);
}
