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

resource "aws_iam_role" "il_test_ag_role" {
  name               = "lambda_execution_role"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

data "aws_iam_policy" "lambda_basic_execution_policy" {
  arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "function_logging_policy_attachment" {
  role       = aws_iam_role.il_test_ag_role.name
  policy_arn = data.aws_iam_policy.lambda_basic_execution_policy.arn
}

# Package the Lambda function code
data "archive_file" "il_test_ag_archive" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda.zip"
}

# Lambda function
resource "aws_lambda_function" "il_test_ag_function" {
  filename         = data.archive_file.il_test_ag_archive.output_path
  function_name    = "il_test_ag_lambda_function"
  role             = aws_iam_role.il_test_ag_role.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.il_test_ag_archive.output_base64sha256

  runtime = "nodejs20.x"

  environment {
    variables = {
      ENVIRONMENT = "sandbox"
      LOG_LEVEL   = "info"
    }
  }

  tags = {
    Environment = "sandbox"
    Application = "itty-lambda-test-ag"
  }
}

# API Gateway and stage
resource "aws_apigatewayv2_api" "il_test_ag_gateway" {
  name          = "il_test_ag_lambda_gw"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "lambda" {
  api_id = aws_apigatewayv2_api.il_test_ag_gateway.id

  name        = "il_test_ag_lambda_stage"
  auto_deploy = true
}

# gateway integration
resource "aws_apigatewayv2_integration" "il_test_ag_integration" {
  api_id = aws_apigatewayv2_api.il_test_ag_gateway.id

  integration_uri    = aws_lambda_function.il_test_ag_function.invoke_arn
  integration_type   = "AWS_PROXY"
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "hello_world" {
  api_id = aws_apigatewayv2_api.il_test_ag_gateway.id

  route_key = "POST /some/path"
  target    = "integrations/${aws_apigatewayv2_integration.il_test_ag_integration.id}"
}

resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.il_test_ag_function.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.il_test_ag_gateway.execution_arn}/*/*"
}