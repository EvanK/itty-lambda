#!/bin/env bash

TEST_DIR="test/unit"

for i in {1..5}; do
  SEQ_NUM=$(printf "%03d" $i)

  for TEMP_FILE in $(ls -1 "${TEST_DIR}/${SEQ_NUM}-"*".template."*"js" 2>/dev/null); do

    FILE_BASE=$(basename $TEMP_FILE)
    FILE_EXT="${FILE_BASE##*.}"
    FILE_TARGET="${TEST_DIR}/${SEQ_NUM}.prepared.test.${FILE_EXT}"

    echo "Preparing $FILE_TARGET"

    cat "$TEMP_FILE" "${TEST_DIR}/${SEQ_NUM}-spec.js" > "$FILE_TARGET"
  done

done
