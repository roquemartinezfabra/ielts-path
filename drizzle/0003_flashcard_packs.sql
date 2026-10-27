CREATE TABLE flashcard_pack_parts (
    user_id text NOT NULL,
    pack_id text NOT NULL,
    version text NOT NULL,
    part_index integer NOT NULL,
    card_count integer NOT NULL,
    installed_at text NOT NULL,
    PRIMARY KEY (user_id, pack_id, version, part_index)
);
