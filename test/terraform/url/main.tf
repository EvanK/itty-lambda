provider "aws" {
  region = "us-east-1"
}

# IAM role for Lambda execution
data "aws_iam_policy_document" "assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "il_test_url_role" { # il_test_url_role
  name               = "lambda_execution_role"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

data "aws_iam_policy" "lambda_basic_execution_policy" {
  arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "function_logging_policy_attachment" {
  role       = aws_iam_role.il_test_url_role.name
  policy_arn = data.aws_iam_policy.lambda_basic_execution_policy.arn
}

# Package the Lambda function code
data "archive_file" "il_test_url_archive" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda.zip"
}

# Lambda function
resource "aws_lambda_function" "il_test_url_function" {
  filename         = data.archive_file.il_test_url_archive.output_path
  function_name    = "example_lambda_function"
  role             = aws_iam_role.il_test_url_role.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.il_test_url_archive.output_base64sha256

  runtime = "nodejs20.x"

  environment {
    variables = {
      ENVIRONMENT = "sandbox"
      LOG_LEVEL   = "info"
    }
  }

  tags = {
    Environment = "sandbox"
    Application = "itty-lambda-test-url"
  }
}

# Function url
resource "aws_lambda_function_url" "il_test_url_endpoint" {
  function_name      = aws_lambda_function.il_test_url_function.function_name
  authorization_type = "NONE"
}
