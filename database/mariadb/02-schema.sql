-- Esquema mínimo transaccional utilizado por el adaptador MariaDB de SIGA.
-- La base debe crearse y seleccionarse previamente. No se usa `USE siga`
-- porque cPanel asigna nombres prefijados, por ejemplo `cuenta_siga`.

CREATE TABLE IF NOT EXISTS estado_aplicacion (
  estado_aplicacion_id TINYINT UNSIGNED NOT NULL,
  version_esquema INT UNSIGNED NOT NULL,
  datos_json LONGTEXT NOT NULL,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT UTC_TIMESTAMP(3),
  PRIMARY KEY (estado_aplicacion_id),
  CONSTRAINT ck_estado_aplicacion_unico CHECK (estado_aplicacion_id = 1),
  CONSTRAINT ck_estado_aplicacion_json CHECK (JSON_VALID(datos_json))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
